"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { useRealtime, useSignal } from "@/service/providers"
import { toast } from "@/hooks/use-toast"

export function Settings() {
  const rt = useRealtime()

  const userAuth = useSignal(rt.getSignal("user:auth"))
  const robots = useSignal(rt.getSignal("robot:list")) || []
  const robotTelemetry = useSignal(rt.getSignal("robot:telemetry")) || {}
  const robotRegisters = useSignal(rt.getSignal('robot:telemetry_registers'));

  const [webrtcConfig, setWebrtcConfig] = useState(); // Dummy for now

  const [name, setName] = useState<string | null>(userAuth?.name || null)
  const [selectedRobot, setSelectedRobot] = useState<string | null>(
    (robots[0] && robots[0].id) || null
  )

  useEffect(() => {
    setName(userAuth?.name || null)
  }, [userAuth?.name])

  useEffect(() => {
    if (robots && robots.length && !selectedRobot) {
      setSelectedRobot(robots[0].id)
    }
  }, [robots])

  const selectedRobotObj = useMemo(() => {
    return (robots as any[]).find((r) => r.id === selectedRobot) || null
  }, [robots, selectedRobot])

  function saveUser() {
    rt.send({
      type: "user:update", name
    });
    toast({
      title: "Saved",
      description: "User settings updated", duration: 3000
    });
  }

  function saveWebrtc() {
    // For now just toast
    toast({
      title: "Saved",
      description: "WebRTC config updated (dummy)",
      duration: 3000
    });
  }

  function toggleDrivers(enable: boolean) {
    if (!selectedRobot)
      return;

    rt.send({
      type: "robot:drivers",
      robot: selectedRobot,
      enable
    });

    toast({ title: "Requested", description: `Drivers ${enable ? 'enable' : 'disable'} requested`, duration: 3000 })
  }

  function toggleHV(enable: boolean) {
    if (!selectedRobot)
      return;
    rt.send({
      type: "robot:hv",
      robot: selectedRobot,
      enable
    });
    toast({
      title: "Requested",
      description: `HV ${enable ? 'enable' : 'disable'} requested`,
      duration: 3000
    });
  }

  function toggleLV(enable: boolean) {
    if (!selectedRobot)
      return;
    rt.send({
      type: "robot:lv",
      robot: selectedRobot,
      enable
    });
    toast({
      title: "Requested",
      description: `LV ${enable ? 'enable' : 'disable'} requested`,
      duration: 3000
    });
  }

  // Dummy registers state (TMC5160 and INA228)
  const [tmcRegisters, setTmcRegisters] = useState<Array<{ name: string; addr: string; value: string }>>([
    { name: "TORQUE", addr: "0x01", value: "0x0000" },
    { name: "VELOCITY", addr: "0x02", value: "0x0000" },
  ]);

  const [inaRegisters, setInaRegisters] = useState<Array<{ name: string; addr: string; value: string }>>([
    { name: "VIN", addr: "0x10", value: "0x0000" },
    { name: "IIN", addr: "0x11", value: "0x0000" },
  ]);

  function writeRegister(chip: "tmc" | "ina", addr: string, value: string) {
    if (!selectedRobot) return
    rt.send({ type: "robot:write_register", robot: selectedRobot, chip, addr, value })
    toast({ title: "Write queued", description: `${chip} ${addr} ← ${value}`, duration: 2500 })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Name</label>
              <Input value={name ?? ""} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Role</label>
              <Input value={(userAuth?.role || "guest") as any} readOnly />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveUser}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WebRTC configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">ICE Servers</label>
              <Input value={webrtcConfig?.iceServers} onChange={(e) => setWebrtcConfig((s) => ({ ...s, iceServers: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">SDP Semantics</label>
              <Input value={webrtcConfig?.sdpSemantics} onChange={(e) => setWebrtcConfig((s) => ({ ...s, sdpSemantics: e.target.value }))} />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveWebrtc}>Save WebRTC</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Robot configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Select Robot</label>
              <Select value={selectedRobot ?? undefined} onValueChange={(v) => setSelectedRobot(v)}>
                <SelectTrigger>
                  <SelectValue>{selectedRobotObj?.name ?? 'Select'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(robots as any[]).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name || r.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">Telemetry preview</label>
              <div className="bg-muted p-3 rounded">
                <div className="text-xs text-muted-foreground mb-2">Realtime telemetry</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  {Object.keys(robotTelemetry || {}).length === 0 && (
                    <div className="col-span-2 text-muted-foreground">No telemetry yet</div>
                  )}
                  {Object.entries(robotTelemetry || {}).map(([k, v]) => (
                    <div key={k} className="flex flex-start gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="text-sm text-muted-foreground block mb-1">Power / Drivers</label>
            </div>
            <div className="flex">
              <div className="flex gap-1 mr-4 border-1">
                <Button onClick={() => toggleDrivers(true)}>Enable Drivers</Button>
                <Button variant="destructive" onClick={() => toggleDrivers(false)}>Disable Drivers</Button>
              </div>
              <div className="flex gap-1 mx-4 border-1">
                <Button onClick={() => toggleHV(true)}>Enable HV</Button>
                <Button variant="destructive" onClick={() => toggleHV(false)}>Disable HV</Button>
              </div>
              <div className="flex gap-1 ml-4 border-1">
                <Button onClick={() => toggleLV(true)}>Enable LV</Button>
                <Button variant="destructive" onClick={() => toggleLV(false)}>Disable LV</Button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Registers (TMC5160)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Addr</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tmcRegisters.map((r) => (
                  <TableRow key={r.addr}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.addr}</TableCell>
                    <TableCell>
                      <Input value={r.value} onChange={(e) => setTmcRegisters((s) => s.map(x => x.addr === r.addr ? { ...x, value: e.target.value } : x))} />
                    </TableCell>
                    <TableCell>
                      <Button onClick={() => writeRegister('tmc', r.addr, r.value)}>Write</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h4 className="font-medium mb-2">Registers (INA228)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Addr</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inaRegisters.map((r) => (
                  <TableRow key={r.addr}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.addr}</TableCell>
                    <TableCell>
                      <Input value={r.value} onChange={(e) => setInaRegisters((s) => s.map(x => x.addr === r.addr ? { ...x, value: e.target.value } : x))} />
                    </TableCell>
                    <TableCell>
                      <Button onClick={() => writeRegister('ina', r.addr, r.value)}>Write</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
