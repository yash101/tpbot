import { useWebsocketApi, useSignal } from "../service/websocket-api.provider";
import { MessageType, RobotAcquireRequest, RobotListRequest, RobotListResponse } from "../api/websocket-api.protocol";
import { TopNav, TopNavLeft, TopNavRight } from "../components/TopNav";
import { WebsocketApiState } from "../reducer/websocket-api-reducer";
import { useEffect, useRef } from "react";
import { useInterval } from "../util/use-interval";
import { useNavigate } from "react-router-dom";

export interface RobotListProps {
  state: WebsocketApiState
}

export function RobotList(props: RobotListProps) {
  const nav = useNavigate();
  const wsApi = useWebsocketApi();
  const robots = useSignal(wsApi.getSignal<RobotListResponse>(MessageType.ROBOT_LIST_RESPONSE));
  const interval = useInterval(() => {
    wsApi.send<RobotListRequest>({
      type: MessageType.ROBOT_LIST_REQUEST,
    });
  }, 2000);

  if (!props.state.authenticated) nav('/login');
  if (props.state.hasRobotControl) nav('/control');

  const robotList = robots?.robots ?? [];

  const requestRobot = (robotUserId: number, steal: boolean | undefined) => {
    wsApi.send<RobotAcquireRequest>({
      type: MessageType.ROBOT_ACQUIRE_REQUEST,
      robotUserId,
      steal,
    });
  };

  return (
    <main className="w-full">
      <TopNavLeft>
        <span>Robot &gt; List</span>
      </TopNavLeft>
      <TopNav />
      <div className="page">
        <section className="panel">
          <h1>Connected Robots</h1>
          {robotList.length === 0 ? (
            <p className="muted">No robots are connected.</p>
          ) : (
            <ul className="robot-list">
              {robotList.map((robot) => (
                <li key={robot.robotUserId} className="robot-row">
                  <div>
                    <strong>{robot.name}</strong>
                    <p>{robot.available ? "Available" : "In use"}</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => requestRobot(robot.robotUserId, robot.available ? undefined : true)}>
                      {robot.available ? "Connect" : "Steal"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
