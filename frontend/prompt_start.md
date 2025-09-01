# Try using v0 to generate a starter?

Design / build a control ui terminal for a telepresence robot.
Few different in the UI:
1. User can be a guest, user, admin or a robot.
2. Robot shows a video feed and has some space for textual telemetry info
3. User can request control of the robot. If granted control, user can control the robot using keyboard, joystick or on-screen buttons.
4. Admin can see all users and robots, and can assign control of a robot to a user. Admin can also assign users / guests and robots to parties.
5. Make a status screen showing the different components of the system and if they are connected. The following components:
  * Backend
  * LLBE
  * Robot
  * Deathstar
6. All users and guests in a party can view the video feed of any robot. They can choose the robot to view. The telemetry should also be visible to all users and guests in the party.
7. Only one user can have control of a robot at a time.
8. Use client-side rendering and design for a fully websocket-based UI.
