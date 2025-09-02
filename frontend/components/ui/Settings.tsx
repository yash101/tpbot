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

export type RobotRegisters = {
  chips: Array<{
    id: string;
    name: string;
    registers: Array<{
      addr: string;
      value: string;
      name: string | null;
      ro: boolean | null;
    }>;
  }>;
}

export function Settings() {
  const rt = useRealtime()

  const userAuth = useSignal(rt.getSignal("user:auth"))
  const robots = useSignal(rt.getSignal("robot:list")) || []
  const robotTelemetry = useSignal(rt.getSignal("robot:telemetry")) || {}
  const robotRegisters = useSignal<RobotRegisters>(
    rt.getSignal('robot:telemetry_registers')
  ); // Of type RobotRegisters

  const [webrtcConfig, setWebrtcConfig] = useState<{ iceServers: string; sdpSemantics: string }>({ iceServers: 'stun:stun.l.google.com:19302', sdpSemantics: 'unified-plan' }); // Dummy for now

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

  // Registers provided from the realtime signal
  // Expected shape: { chips: [{ id, name, registers: [{ addr, value, name?, ro? }] }] }
  // robotRegisters may be null/undefined until the server provides it.

  // Request registers when selected robot changes
  useEffect(() => {
    if (selectedRobot) {
      rt.send({ type: "robot:get_registers", robot: selectedRobot })
    }
  }, [selectedRobot])

  // Populate dummy registers so UI shows something while backend is absent.
  useEffect(() => {
    // Create sample registers for two common chips
    const dummy = {
      chips: [
        {
          id: "tmc5160",
          name: "TMC5160",
          registers: [
            { addr: "0x01", value: "0x0001", name: "TORQUE", ro: false },
            { addr: "0x02", value: "0x0000", name: "VELOCITY", ro: false },
            { addr: "0x03", value: "0x00FF", name: "STATUS", ro: true },
          ],
        },
        {
          id: "ina228",
          name: "INA228",
          registers: [
            { addr: "0x10", value: "0x1A2B", name: "VIN", ro: true },
            { addr: "0x11", value: "0x00C8", name: "IIN", ro: true },
            { addr: "0x12", value: "0x0000", name: "CONFIG", ro: false },
          ],
        },
      ],
    }

    // Set the dummy registers into the realtime signal so the Settings UI can read them
    try {
      rt.getSignal("robot:telemetry_registers").set(dummy)
    } catch (e) {
      // ignore if signal not available
      console.debug("Failed to set dummy registers", e)
    }
  }, [])

  // local edits: map of `${chipId}:${addr}` -> editedValue
  const [registerEdits, setRegisterEdits] = useState<Record<string, string>>({})

  function writeRegister(chipId: string, addr: string, value: string) {
    if (!selectedRobot) return
    rt.send({ type: "robot:write_register", robot: selectedRobot, chip: chipId, addr, value })
    toast({ title: 'Pushed register update', description: `${chipId} ${addr} ← ${value}`, duration: 2500 })
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
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Device Registers</h4>
            </div>

            {(!robotRegisters || !robotRegisters.chips || robotRegisters.chips.length === 0) && (
              <div className="text-sm text-muted-foreground">No registers available for this robot.</div>
            )}

            {(robotRegisters?.chips || []).map((chip) => (
              <div key={chip.id} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium">{chip.name || chip.id}</div>
                    <div className="text-xs text-muted-foreground">Device ID: {chip.id}</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Addr</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>New Value</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(chip.registers || []).map((reg) => {
                      const key = `${chip.id}:${reg.addr}`
                      const edited = registerEdits[key]
                      const isRo = reg.ro === true
                      return (
                        <TableRow key={key}>
                          <TableCell>{reg.name || "UNKNOWN"}</TableCell>
                          <TableCell>{reg.addr}</TableCell>
                          <TableCell><div className="font-mono">{String(reg.value)}</div></TableCell>
                          <TableCell>
                            <Input
                              value={edited ?? String(reg.value ?? "")}
                              onChange={(e) => setRegisterEdits((s) => ({ ...s, [key]: e.target.value }))}
                              readOnly={isRo}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => writeRegister(chip.id, reg.addr, registerEdits[key] ?? String(reg.value ?? ""))}
                                disabled={isRo}
                              >
                                Write
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Settings
