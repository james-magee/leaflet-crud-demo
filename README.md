# What is this?
To demonstrate my ability to get a working app with leaflet.js running, I have built this browser extension
that can be used to render the location of a UBC Intramurals League event on a leaflet map instance.
In order to place polygons (rectangles) cleanly on the map, the extension has an "edit" mode which can be
toggled by pressing `.` From there, you can:
1. click on a part of the map without any rectangles to spawn a new one.
2. select it by clicking on it
3. change the first side length by using keys `1` (increase) and `2` (decrease); change second side length by using keys `3` (increase), `4` (decrease).
4. rotate clockwise (about the center) using ArrowRight and counterclockwise using ArrowLeft
5. translate using `wasd`
6. press `P` (uppercase) to print out the corner coordinates of the rectangles in the console (they will be printed in the same)

# Setting it up
1. clone the repo into demo/: `git clone https://github.com/james-magee/leaflet-crud-demo.git demo/`
2. `npm install` (to get leaflet and leaflet types)
3. `npm run build` to build output into dist/
4. if using firefox, go to about:debugging > load temporoary add-on > point to demo/dist/mainfest.json
5. Go to one of UBC Intramural's Leagues game schedules:

(currently supported):
https://recreation.ubc.ca/intramurals/leagues/point-grey-cup-football/term-1-standings/
https://recreation.ubc.ca/intramurals/leagues/dodgeball/term-1-standings/
https://recreation.ubc.ca/intramurals/leagues/cross-volleyball/term-1-standings/

6. Click on the location to see the leaflet map drop down. (Click on the location to toggle it).
7. Press `.` to enter edit mode (create new rectangles and transform them.)

To see default (no leaflet map) go back to about:debugging > Remove extension.
