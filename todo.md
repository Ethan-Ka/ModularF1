
# Urgent To Do 

LOOPING ONNBOARDING SCREEN

Automatically detect when a race is about to start and shift into live mode.
Show an "upcoming race" state in the ambient bar with a distinct color.
Only show the green ambient bar when the race is actually live.
If no live API key is present or the user desires, allow fallback to historical mode (onboarding prompt or fallback button).
I will start by updating the session detection and ambient bar logic in App.tsx and AmbientBar.tsx, and add a fallback to historical mode if no live key is present.

Your codebase has multiple destructurings of useSessionStore() in different scopes, which caused the patch to fail due to context mismatch. To proceed, I will:

Update the destructuring in the correct scope in App.tsx to include setMode and apiKey.
Add the automatic mode detection effect at the top level of the App component.
Update the DataLayer effect to set the CALM flag for upcoming races.
Let me make these changes step by step for clarity and reliability.

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