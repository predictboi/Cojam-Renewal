# Image sources

Every picture in this folder was drawn for this project as an SVG illustration in the Cojam palette (blue `#124CC4`, volt `#D6FF3D`, ink `#0B1530`, sky `#97DBFF`, snow `#FDFDFF`). No third party photo or artwork is used, nothing is hotlinked, and there is no licence to track: the files belong to the Cojam repository.

| File | Used by | What it shows | Source | Licence |
| --- | --- | --- | --- | --- |
| `q1-bitcoin.svg` | mock question 1 (Crypto) | Bitcoin coin, rising price line, 100K target | Drawn for this project (generated SVG) | Project owned |
| `q2-dollar-won.svg` | mock question 2 (Markets) | Dollar and won coins, bar chart, 1,400 line | Drawn for this project (generated SVG) | Project owned |
| `q3-seoul-weather.svg` | mock question 3 (Weather) | Sun, cloud, Seoul skyline, 10 degree mark | Drawn for this project (generated SVG) | Project owned |
| `q4-football.svg` | mock question 4 (Sports) | Football flying into the net, 3 plus mark | Drawn for this project (generated SVG) | Project owned |
| `q5-kaia.svg` | mock question 5 (Crypto) | Up and down arrows over price candles | Drawn for this project (generated SVG) | Project owned |

Format: 4:5 portrait (viewBox 800 x 1000). The subject sits in the top 55% of the frame; the bottom 45% is covered by the question text and the two choice buttons on the card, so nothing important goes there.

The fallback for a question with no image is not a file: the card draws the category icon on the blue grid ground (see `.qimg--fallback` in `components.css`).

If photos are used later, save them here at about 800 px wide (WebP or JPEG, under 120 KB), never hotlink, and add a row with the photographer, the source URL and the licence.
