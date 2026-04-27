import { useEffect, useReducer, useState } from "react";
import {
  WebsocketApiProvider,
  useWebsocketApi,
  useSignal
} from "@/src/service/websocket-api.provider";
import {
  ActiveUserRole,
  Message,
} from "./api/websocket-api.protocol";
import { LoginScreen } from "./page/Login";
import { RobotList } from "./page/RobotList";
import { TopNavProvider } from "./components/TopNav";
import { initialWebsocketApiState, reduce, WebsocketApiState } from "./reducer/websocket-api-reducer";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./page/home";
import { Control } from "./page/Control";
import { BotPage } from "./page/Bot";
import { SettingsProvider } from "./service/settings.provider";
import { SettingsPane } from "./components/settings.component";

export function App() {
  return (
    <WebsocketApiProvider>
      <SettingsProvider>
        <TopNavProvider>
          <Router />
        </TopNavProvider>
      </SettingsProvider>
    </WebsocketApiProvider>
  );
}

export function Router() {
  const rt = useWebsocketApi();
  const [appState, dispatch] = useReducer(reduce, initialWebsocketApiState);
  const newMessageSignal = useSignal(rt.message);
  useEffect(() => dispatch(newMessageSignal as Message), [ newMessageSignal ]);

  return (
    <BrowserRouter>
      <SettingsPane />
      <Routes>
        <Route path="/" element={<HomePage state={appState} />} />
        <Route path="/login" element={<LoginScreen state={appState} />} />
        <Route path="/bot" element={<BotPage state={appState} />} />
        <Route path="/list-bots" element={<RobotList state={appState} />} />
        <Route path="/control" element={<Control state={appState} />} />
      </Routes>
    </BrowserRouter>
  );
}
