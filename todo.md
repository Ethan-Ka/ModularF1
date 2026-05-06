
# Urgent To Do 

- [ ] Fix season standings thing/data
  - [ ] Constructors is fixed when I load live modes and open the standings popup
- [ ] Fix season roadmap 
  - [ ] Add clickable data about each race
- [ ] Fix demo mode track map
- [ ] make logging log errors from console
- [ ] Update settings
- [ ] Make configuring canvas clearer
- [ ] add legend for races back to the bottom of the reason roadmap
- [ ] make bbc not the only F1 source - ADD OFFICIAL FIA AND F1 ANNOUNCEMENTS
- [ ] Add timezone to next race time display
- [ ] add a bunch of stuff to the loading sequence
- [ ] 

FIX THE SECTOR MAP AND TRACK MAP


rewrite the sectormap widget. It should be an image of the deatiled track(the one that has sectors) and then use the track and drivers that are rendered on teh track map and overlay it over the detailed track map. This is to keep the positioning of the drivers intact. There should be an algorithm to determine the detailed track map positioning, and adjus tthe overlayed regular track map to match. This is because the detailed track maps don't match the size and rotation of the regular track maps. You should use sectormap/index.tsx for the widget. Don't focus on the current implemnentation. It is not working ad I want to scrap it


Refactor codebase to make logic not strange

Test all items in a live setting

# Test Run - Miami 5/3/26 - Bugs

Sessions are not retrieved as well. It can be allowed to not do any OpenF1 requests in FastF1 live mode(it can be used for historical) until we need to request OpenF1 session data to start requesting it from FastF1.


Widgets needs to be smaller lol

Make global widgets - race control, radio , LapDelta, strategy timelines not driver focusable

Popped out widgets need to sync up with the nmain window - starred drivers, focus select, etc

Factor temperature and lap speed(how hard the car is driven) into the tire degredation engine. Share the tire degredation across all tire widgets. 

P1 and a driver should not be able to be selected at the same time

# To Do

- [ ] fix popout widgets sync
- [ ] Fix season standings thing/data
- [ ] add a widget for individual driver radio?
- [x] Implement data from [f1db](https://github.com/f1db/f1db/) (give credit)
- [x] Implement widgets
- [ ] Radio system
- [x] Championship tracker screen, points, etc
- [x] Car visualization system
- [ ] Track system with visual circuit display
- [ ] Make pop-out windows, etc. less glitchy
- [x] Figure out F1 API fork options(for people who have F1TV who don't want to pay for OpenF1)
- [ ] Ambient race layer smooth transitions
- [ ] Ambient race layer external API/home device support
- [x] Consistent driver context system that makes sense for every usecase
- [ ] Make sure export system functions properly
- [ ] Inference engine that has a high accuracy (UPDATE README SO ENGINE DATA IS NOT HALLUCINATED)
- [ ] Plugin support(with security measures)
- [ ] Proper workspace and multi-window support for workspaces
- [ ] Windows that sync across eachother
- [ ] For Free plans Up to 3 requests per second and 30 requests per minute
- [ ] For paid plans Live data during sessions with REST, MQTT, and WebSocket
Up to 6 requests per second and 60 requests per minute
- [x] Add national anthem and track specific color functionality to the ambient race bar
- [x] Implement database
- [x] Develop the widgets
- [ ] User setup flow
- [ ] Link separate 'main' windows
- [ ] Layout export and sharing
- - [ ] Plugins for custom widgets and or functionality
- [x] Weather
- [ ] Special focus on audio/comms
- [x] Championship and driver/team standings
  - [ ] Driver backgrounds and individual profiles, etc.
- [x] Car and track custom svgs for map widget and car widget
- [ ] F1TV/Stream overlay with driver/different camera detection
- [x] switch between live and historical mode
- [x] Hide log behind menu lol
- [ ] Better inference engine
- [ ] RGB Bridge
- [ ] Back end
- [ ] Replay races with time etc
- [ ] System tray and overlay layout editor
- [x] Update readme
- [ ] Features for people watching on their tv with pitwall on oanother device?
