'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Monitor,
} from "lucide-react"
import { useRealtime, useSignal } from "@/service/providers";
import { UserInfo, UserRole } from "@/service/types";
import { getStatusColor } from "@/utils/utils";

export type RobotListProps = {
  user: UserInfo
};

export const RobotList: React.FC<RobotListProps> = ({
  user,
}) => {
  const rt = useRealtime();
  const assignedParty = useSignal(rt.getSignal('user:party_membership'));
  const robots = useSignal(rt.getSignal('robot:list'));
  const assignedRobot = useSignal(rt.getSignal('robot:assigned'));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Party: {assignedParty?.id || 'unassigned'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {robots?.length || 0} robots available
          </Badge>
          {user.role === UserRole.ADMIN && <Badge
            variant="secondary"
          >
            Admin - All robots accessible
          </Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(robots || []).map((robot: any) => (
            <Card
              key={robot.id}
              className={[
                'cursor-pointer',
                'transition-all',
                assignedRobot?.id === robot.id ?
                  "ring-2 ring-primary" :
                  "hover:bg-muted/50",
              ].join(' ')}
            // onClick={() => setViewingRobot(robot.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">{robot.name}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(robot.status)}`} />
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Battery:</span>
                    <span>{Math.round(robot.battery)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signal:</span>
                    <span>{Math.round(robot.signal)}%</span>
                  </div>
                  {robot.controller && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Controller:</span>
                      <span className="text-xs">{robot.controller}</span>
                    </div>
                  )}
                </div>

                {/* {viewingRobot === robot.id && (
                    <Badge variant="default" className="mt-2 w-full justify-center">
                      <Eye className="h-3 w-3 mr-1" />
                      Viewing
                    </Badge>
                  )} */}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
