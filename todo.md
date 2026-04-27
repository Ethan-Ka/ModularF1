
# Urgent To Do 

The onboarding srceen comes up every time

Also fix the multiple window system

Consolidate a bunch of methods and everything to make plugins/widgets as simple as possible to implement


i messed up the settings page

Live mode is allowed only if OpenF1 API key is present

When toggling between the fastf1/openf1 switcher, don't re-open the onboarding screen

Move FastF1/OpenF1 switcher and the fastF1 settings to the account area: The FastF1 authentication and server status UI will be moved into the "Account & Mode" section at the top of the settings panel, under the dedicated switch for the switcher.
Move OpenF1 API key under the FastF1/OpenF1 switchers: The API key input and display will be grouped under the data source switchers, making it clear which key is used for which mode.
Live mode checks should be satisfied by F1TV sign-in: The "Live" mode button will be enabled if either an OpenF1 API key is present or the user is authenticated with F1TV (FastF1).

# To Do


- [x] Implement data from [f1db](https://github.com/f1db/f1db/) (give credit)
- [ ] Implement widgets
- [ ] Radio system
- [x] Championship tracker screen, points, etc
- [ ] Car visualization system
- [ ] Track system with visual circuit display
- [ ] Make pop-out windows, etc. less glitchy
- [x] Figure out F1 API fork options(for people who have F1TV who don't want to pay for OpenF1)
- [ ] Ambient race layer smooth transitions
- [ ] Ambient race layer external API/home device support
- [ ] Consistent driver context system that makes sense for every usecase
- [ ] Make sure export system functions properly
- [ ] Inference engine that has a high accuracy (UPDATE README SO ENGINE DATA IS NOT HALLUCINATED)
- [ ] Plugin support(with security measures)
- [ ] Proper workspace and multi-window support for workspaces
- [ ] Windows that sync across eachother
- [ ] For Free plans Up to 3 requests per second and 30 requests per minute
- [ ] For paid plans Live data during sessions with REST, MQTT, and WebSocket
Up to 6 requests per second and 60 requests per minute
- [ ] Add national anthem and track specific color functionality to the ambient race bar
- [x] Implement database
- [ ] Develop the widgets
- [ ] User setup flow
- [ ] Link separate 'main' windows
- [ ] Layout export and sharing
- - [ ] Plugins for custom widgets and or functionality
- [ ] Weather
- [ ] Special focus on audio/comms
- [x] Championship and driver/team standings
  - [ ] Driver backgrounds and individual profiles, etc.
- [ ] Car and track custom svgs for map widget and car widget
- [ ] F1TV/Stream overlay with driver/different camera detection
- [ ] switch between live and historical mode
- [ ] Hide log behind menu lol
- [ ] Better inference engine
- [ ] RGB Bridge
- [ ] Back end
- [ ] Replay stuff?
- [ ] System tray and overlay layout editor
- [ ] Update readme
- [ ] Features for people watching on their tv with pitwall on oanother device?