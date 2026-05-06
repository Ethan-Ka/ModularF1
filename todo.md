# Urgent To Do 

Make app run in 60fps :(

FIX THE SECTOR MAP AND TRACK MAP

rewrite the sectormap widget. It should be an image of the deatiled track(the one that has sectors) and then use the track and drivers that are rendered on teh track map and overlay it over the detailed track map. This is to keep the positioning of the drivers intact. There should be an algorithm to determine the detailed track map positioning, and adjus tthe overlayed regular track map to match. This is because the detailed track maps don't match the size and rotation of the regular track maps. You should use sectormap/index.tsx for the widget. Don't focus on the current implemnentation. It is not working ad I want to scrap it

Refactor codebase to make logic not strange

Widgets needs to be smaller lol

Popped out widgets need to sync up with the nmain window - starred drivers, focus select, etc



# SeasonHub To Do

Improve scrolling for the season calendar - horizontal scrolling and a scroll-driven animation with a cliff for the bottom part but a steady scroll for the top part. If released before the cliff then it just goes back to the current race

- [ ] populate season calendar map more
- [x] decrease size of season caelndar lines
- [x] Hide calendar lines that are not related (incoming our outgoing) to the current race
- [ ] Make all text larger
- [x] Drievrs championship mode is left aligned
- [x] decrease size of the bubble on the season calendar map location, make the bubble on top
- [ ] make the map serve a purpose
- [x] remove vignette around window
- [x] in the bottom of the next race display(bottom left)
  - [x] Add settings button
  - [x] account login/logout stuff
  - [x] Driver manager button
  - [x] canvas view button
- [ ] Make pitwall logo larger across the app (and the bar)
- [x] Fix season standings thing/data
  - [x] Constructors is fixed when I load live modes and open the standings popup
- [x] Fix season roadmap
  - [x] add more track data
- [ ] Fix demo mode track map
- [ ] make logging log errors from console
- [ ] Update settings
- [ ] Make configuring canvas clearer
- [x] add legend for races back to the bottom of the reason roadmap
- [x] improve sources for the headlines - more interesting headlines
- [ ] Add timezone to next race time display
- [ ] add a bunch of stuff to the loading sequence
- [ ] popup modals are embedded into previous popup modals
- [ ] Fix widget settings and driver manager being stuck inside popout widgets bounds

# To Do

- [ ] fix popout widgets sync
- [ ] P1 and a driver should not be able to be selected at the same time
- [ ] add a widget for individual driver radio?
- [ ] Radio system
- [ ] Make global widgets not driver-focusable
- [ ] Track system with visual circuit display
- [ ] Make pop-out windows, etc. less glitchy
- [ ] Ambient race layer smooth transitions
- [ ] Ambient race layer external API/home device support
- [x] Consistent driver context system that makes sense for every usecase
- [ ] Make sure export system functions properly
- [ ] Inference engine that has a high accuracy (UPDATE README SO ENGINE DATA IS NOT HALLUCINATED)
- [ ] Plugin support(with security measures)
- - [ ] Plugins for custom widgets and or functionality
- [ ] Special focus on audio/comms
- [ ] F1TV/Stream overlay with driver/different camera detection
- [ ] Better inference engine
  - [ ] Factor temperature and lap speed(how hard the car is driven) into the tire degredation engine. Share the tire degredation across all tire widgets. 
- [ ] RGB Bridge
- [ ] Back end
- [ ] System tray and overlay layout editor
- [ ] Features for people watching on their tv with pitwall on oanother device?
