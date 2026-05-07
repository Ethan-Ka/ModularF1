import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react'
// @ts-ignore
import Globe from 'react-globe.gl'
import { useSessionStore } from '../../store/sessionStore'
import { CIRCUIT_COORDS } from '../../data/circuitCoords'
import type { OpenF1Session } from '../../api/openf1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaceWeekend {
  meetingKey: number
  circuitShort: string
  countryName: string
  meetingName: string
  sessions: OpenF1Session[]
  earliestStart: number
  roundNumber: number
}

interface GlobeCalendarProps {
  weekends: RaceWeekend[]
  now: number
  imminentMeetingKey: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_META: Record<string, { label: string; color: string; order: number }> = {
  'Practice 1':        { label: 'P1', color: 'rgba(160,168,180,0.7)', order: 0 },
  'Practice 2':        { label: 'P2', color: 'rgba(160,168,180,0.7)', order: 1 },
  'Practice 3':        { label: 'P3', color: 'rgba(160,168,180,0.7)', order: 2 },
  'Sprint Qualifying': { label: 'SQ', color: 'rgba(224,144,0,0.8)',   order: 3 },
  'Sprint':            { label: 'S',  color: 'rgba(255,120,0,0.85)',  order: 4 },
  'Qualifying':        { label: 'Q',  color: 'rgba(80,140,255,0.85)', order: 5 },
  'Race':              { label: 'R',  color: 'rgba(232,19,43,0.9)',   order: 6 },
}

const CIRCUIT_FULL_NAME: Record<string, string> = {
  'Austin':        'Circuit of the Americas',
  'Bahrain':       'Bahrain International Circuit',
  'Jeddah':        'Jeddah Corniche Circuit',
  'Melbourne':     'Albert Park Circuit',
  'Suzuka':        'Suzuka Circuit',
  'Shanghai':      'Shanghai International Circuit',
  'Miami':         'Miami International Autodrome',
  'Miami Gardens': 'Miami International Autodrome',
  'Imola':         'Autodromo Enzo e Dino Ferrari',
  'Monaco':        'Circuit de Monaco',
  'Monte Carlo':   'Circuit de Monaco',
  'Montreal':      'Circuit Gilles-Villeneuve',
  'Montréal':      'Circuit Gilles-Villeneuve',
  'Barcelona':     'Circuit de Barcelona-Catalunya',
  'Spielberg':     'Red Bull Ring',
  'Silverstone':   'Silverstone Circuit',
  'Budapest':      'Hungaroring',
  'Spa':           'Circuit de Spa-Francorchamps',
  'Zandvoort':     'Circuit Zandvoort',
  'Monza':         'Autodromo Nazionale Monza',
  'Baku':          'Baku City Circuit',
  'Singapore':     'Marina Bay Street Circuit',
  'Lusail':        'Lusail International Circuit',
  'Las Vegas':     'Las Vegas Strip Circuit',
  'Mexico City':   'Autodromo Hermanos Rodriguez',
  'São Paulo':     'Autodromo Jose Carlos Pace',
  'Sao Paulo':     'Autodromo Jose Carlos Pace',
  'Abu Dhabi':     'Yas Marina Circuit',
  'Madrid':        'Circuit de Madrid',
}

// Maps circuitShort → SVG filename (without .svg) in /seasons/2026/tracks/display/
const TRACK_SVG: Record<string, string> = {
  'Austin':       'austin-1',
  'Bahrain':      'bahrain-1',
  'Jeddah':       'jeddah-1',
  'Melbourne':    'melbourne-1',
  'Suzuka':       'suzuka-1',
  'Shanghai':     'shanghai-1',
  'Miami':        'miami-1',
  'Miami Gardens': 'miami-1',
  'Imola':        'imola-1',
  'Monaco':       'monaco-1',
  'Monte Carlo':  'monaco-1',
  'Montreal':     'montreal-1',
  'Montréal':     'montreal-1',
  'Barcelona':    'catalunya-1',
  'Spielberg':    'spielberg-1',
  'Silverstone':  'silverstone-1',
  'Budapest':     'hungaroring-1',
  'Spa':          'spa-francorchamps-1',
  'Zandvoort':    'zandvoort-1',
  'Monza':        'monza-1',
  'Baku':         'baku-1',
  'Singapore':    'marina-bay-1',
  'Lusail':       'lusail-1',
  'Las Vegas':    'las-vegas-1',
  'Mexico City':  'mexico-city-1',
  'São Paulo':    'interlagos-1',
  'Sao Paulo':    'interlagos-1',
  'Abu Dhabi':    'yas-marina-1',
}

const CIRCUIT_META: Record<string, { laps: number; km: number; turns: number; drs: number; type: 'permanent' | 'street' | 'semi-permanent' }> = {
  'Austin':        { laps: 56, km: 5.513, turns: 20, drs: 2, type: 'permanent' },
  'Bahrain':       { laps: 57, km: 5.412, turns: 15, drs: 3, type: 'permanent' },
  'Jeddah':        { laps: 50, km: 6.174, turns: 27, drs: 3, type: 'street' },
  'Melbourne':     { laps: 58, km: 5.278, turns: 16, drs: 4, type: 'semi-permanent' },
  'Suzuka':        { laps: 53, km: 5.807, turns: 18, drs: 1, type: 'permanent' },
  'Shanghai':      { laps: 56, km: 5.451, turns: 16, drs: 2, type: 'permanent' },
  'Miami':         { laps: 57, km: 5.412, turns: 19, drs: 3, type: 'semi-permanent' },
  'Miami Gardens': { laps: 57, km: 5.412, turns: 19, drs: 3, type: 'semi-permanent' },
  'Imola':         { laps: 63, km: 4.909, turns: 19, drs: 1, type: 'permanent' },
  'Monaco':        { laps: 78, km: 3.337, turns: 19, drs: 1, type: 'street' },
  'Monte Carlo':   { laps: 78, km: 3.337, turns: 19, drs: 1, type: 'street' },
  'Montreal':      { laps: 70, km: 4.361, turns: 14, drs: 2, type: 'semi-permanent' },
  'Montréal':      { laps: 70, km: 4.361, turns: 14, drs: 2, type: 'semi-permanent' },
  'Barcelona':     { laps: 66, km: 4.657, turns: 16, drs: 2, type: 'permanent' },
  'Spielberg':     { laps: 71, km: 4.318, turns: 10, drs: 3, type: 'permanent' },
  'Silverstone':   { laps: 52, km: 5.891, turns: 18, drs: 2, type: 'permanent' },
  'Budapest':      { laps: 70, km: 4.381, turns: 14, drs: 1, type: 'permanent' },
  'Spa':           { laps: 44, km: 7.004, turns: 19, drs: 2, type: 'permanent' },
  'Zandvoort':     { laps: 72, km: 4.259, turns: 14, drs: 1, type: 'permanent' },
  'Monza':         { laps: 53, km: 5.793, turns: 11, drs: 2, type: 'permanent' },
  'Baku':          { laps: 51, km: 6.003, turns: 20, drs: 2, type: 'street' },
  'Singapore':     { laps: 62, km: 4.940, turns: 23, drs: 3, type: 'street' },
  'Lusail':        { laps: 57, km: 5.380, turns: 16, drs: 2, type: 'permanent' },
  'Las Vegas':     { laps: 50, km: 6.201, turns: 17, drs: 2, type: 'street' },
  'Mexico City':   { laps: 71, km: 4.304, turns: 17, drs: 3, type: 'permanent' },
  'São Paulo':     { laps: 71, km: 4.309, turns: 15, drs: 3, type: 'permanent' },
  'Sao Paulo':     { laps: 71, km: 4.309, turns: 15, drs: 3, type: 'permanent' },
  'Abu Dhabi':     { laps: 58, km: 5.281, turns: 16, drs: 2, type: 'permanent' },
  'Madrid':        { laps: 55, km: 5.473, turns: 20, drs: 3, type: 'permanent' },
}

const CIRCUIT_HISTORY: Record<string, {
  since: number
  gps: number
  lapRecord: { driver: string; time: string; year: number } | null
  about: string
  notable: string
  altitudeM: number
  weather: string
}> = {
  'Austin': {
    since: 2012, gps: 13,
    lapRecord: { driver: 'Max Verstappen', time: '1:36.169', year: 2019 },
    about:   'High-speed sweepers and punishing elevation changes cut into the Texas Hill Country limestone.',
    notable: 'Lewis Hamilton clinched his fifth world championship here in 2015. The circuit hosted MotoGP and concert events between F1 rounds.',
    altitudeM: 294, weather: 'Warm & sunny, 25–32°C, risk of afternoon storms',
  },
  'Bahrain': {
    since: 2004, gps: 21,
    lapRecord: { driver: 'Pedro de la Rosa', time: '1:30.252', year: 2005 },
    about:   'Desert circuit set for twilight racing, balancing long straights with a technical infield section.',
    notable: 'Hosted the season-opening Sakhir GP in the pandemic year 2020. The outer layout briefly ran as a record-short sprint circuit.',
    altitudeM: 6, weather: 'Hot & dry, 28–35°C, sand risk in early season',
  },
  'Jeddah': {
    since: 2021, gps: 4,
    lapRecord: { driver: 'Lewis Hamilton', time: '1:27.511', year: 2021 },
    about:   "World's fastest street circuit — a narrow, wall-lined charge averaging over 250 km/h along the Red Sea corniche.",
    notable: 'Max Verstappen and Lewis Hamilton collided here twice in 2021 during their title showdown. A missile strike on an Aramco facility was visible from the pit lane during the 2022 race.',
    altitudeM: 10, weather: 'Hot & humid, 28–36°C, mild sea breeze',
  },
  'Melbourne': {
    since: 1996, gps: 29,
    lapRecord: { driver: 'Charles Leclerc', time: '1:20.235', year: 2022 },
    about:   "Season-opener through Albert Park's tree-lined lakeside roads in the shadow of the city skyline.",
    notable: "Damon Hill won the very first race here in 1996. The circuit uses public roads through Melbourne's inner-south and is dormant for 51 weeks of the year.",
    altitudeM: 30, weather: 'Mild & variable, 18–26°C, autumn showers likely',
  },
  'Suzuka': {
    since: 1987, gps: 37,
    lapRecord: { driver: 'Kimi Räikkönen', time: '1:31.540', year: 2019 },
    about:   'Iconic figure-of-eight layout with the legendary Esses sequence, Spoon curve and terrifying 130R.',
    notable: 'More world championships have been decided at Suzuka than any other circuit. Ayrton Senna and Alain Prost collided here in back-to-back title-deciding incidents in 1989 and 1990.',
    altitudeM: 45, weather: 'Warm & humid, 22–28°C, typhoon risk in October',
  },
  'Shanghai': {
    since: 2004, gps: 19,
    lapRecord: { driver: 'Michael Schumacher', time: '1:32.238', year: 2004 },
    about:   "Sprawling 5.4 km layout inspired by the Shanghai Expo emblem, featuring a long back straight and sweeping first sector.",
    notable: 'Michael Schumacher won the inaugural race here in 2004. The circuit was absent from 2020–2023 due to COVID restrictions before returning in 2024.',
    altitudeM: 5, weather: 'Mild & hazy, 18–26°C, spring humidity',
  },
  'Miami': {
    since: 2022, gps: 3,
    lapRecord: { driver: 'Max Verstappen', time: '1:29.708', year: 2023 },
    about:   'Purpose-built circuit winding around the Hard Rock Stadium, complete with faux marina and beach club aesthetics.',
    notable: 'Charles Leclerc won the first Miami GP in 2022. The event features one of the most elaborate pre-race entertainment programmes on the F1 calendar.',
    altitudeM: 2, weather: 'Hot & humid, 28–34°C, afternoon thunderstorms common',
  },
  'Miami Gardens': {
    since: 2022, gps: 3,
    lapRecord: { driver: 'Max Verstappen', time: '1:29.708', year: 2023 },
    about:   'Purpose-built circuit winding around the Hard Rock Stadium, complete with faux marina and beach club aesthetics.',
    notable: 'Charles Leclerc won the first Miami GP in 2022. The event features one of the most elaborate pre-race entertainment programmes on the F1 calendar.',
    altitudeM: 2, weather: 'Hot & humid, 28–34°C, afternoon thunderstorms common',
  },
  'Imola': {
    since: 1980, gps: 28,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:15.484', year: 2020 },
    about:   'Narrow, unforgiving valley circuit named in honour of Enzo and Dino Ferrari, hugging the Santerno River.',
    notable: 'Ayrton Senna died following a crash at Tamburello corner during the 1994 San Marino GP, the darkest weekend in modern F1 history. The circuit was absent 2007–2019 before returning during COVID.',
    altitudeM: 47, weather: 'Mild & changeable, 18–24°C, spring showers likely',
  },
  'Monaco': {
    since: 1950, gps: 71,
    lapRecord: { driver: 'Max Verstappen', time: '1:12.909', year: 2023 },
    about:   "The jewel of the calendar — impossibly tight Principality streets where one mistake ends your race and overtaking is nearly impossible.",
    notable: "Ayrton Senna won Monaco six times. The race has been held since the very first F1 World Championship in 1950. Winner's average speed barely exceeds 160 km/h.",
    altitudeM: 7, weather: 'Mediterranean, 20–26°C, occasional freak showers',
  },
  'Monte Carlo': {
    since: 1950, gps: 71,
    lapRecord: { driver: 'Max Verstappen', time: '1:12.909', year: 2023 },
    about:   "The jewel of the calendar — impossibly tight Principality streets where one mistake ends your race and overtaking is nearly impossible.",
    notable: "Ayrton Senna won Monaco six times. The race has been held since the very first F1 World Championship in 1950. Winner's average speed barely exceeds 160 km/h.",
    altitudeM: 7, weather: 'Mediterranean, 20–26°C, occasional freak showers',
  },
  'Montreal': {
    since: 1978, gps: 41,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:13.078', year: 2019 },
    about:   "Island circuit on the St. Lawrence River, famous for the Wall of Champions at the hairpin exit.",
    notable: "Gilles Villeneuve, the circuit's namesake, never won here. Michael Schumacher's pit-lane speeding penalty cost him the race in 2001. Safety car deployments are extremely frequent.",
    altitudeM: 20, weather: 'Warm & sunny, 22–28°C, chance of heavy rain',
  },
  'Montréal': {
    since: 1978, gps: 41,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:13.078', year: 2019 },
    about:   "Island circuit on the St. Lawrence River, famous for the Wall of Champions at the hairpin exit.",
    notable: "Gilles Villeneuve, the circuit's namesake, never won here. Michael Schumacher's pit-lane speeding penalty cost him the race in 2001. Safety car deployments are extremely frequent.",
    altitudeM: 20, weather: 'Warm & sunny, 22–28°C, chance of heavy rain',
  },
  'Barcelona': {
    since: 1991, gps: 34,
    lapRecord: { driver: 'Max Verstappen', time: '1:16.330', year: 2021 },
    about:   'A thorough technical examination — testing every aspect of car setup across high-speed, medium and slow corners.',
    notable: 'Used extensively for pre-season testing, meaning teams arrive knowing the circuit better than anywhere else. Michael Schumacher won here a record six times.',
    altitudeM: 115, weather: 'Hot & sunny, 24–32°C, dry and consistent',
  },
  'Spielberg': {
    since: 1970, gps: 33,
    lapRecord: { driver: 'Carlos Sainz', time: '1:05.619', year: 2020 },
    about:   "Compact Red Bull Ring nestled in Austria's Styrian mountains — just 10 turns, brutally fast through all of them.",
    notable: 'Red Bull acquired and rebuilt the circuit in 2011. The lap is so short at 4.3 km that lapped traffic appears within 20 laps. Sprint format has been held here multiple times.',
    altitudeM: 660, weather: 'Warm days, cool nights, 20–28°C, afternoon thunderstorms',
  },
  'Silverstone': {
    since: 1950, gps: 73,
    lapRecord: { driver: 'Max Verstappen', time: '1:27.097', year: 2020 },
    about:   "Home of British motorsport on a former WWII airfield — Copse, Maggotts and Becketts demand commitment at 300 km/h.",
    notable: "Hosted the very first F1 World Championship race in 1950, won by Giuseppe Farina. Lewis Hamilton won the British GP eight times. Max Verstappen suffered a puncture while leading in 2020.",
    altitudeM: 153, weather: 'Cool & changeable, 18–24°C, rain very possible',
  },
  'Budapest': {
    since: 1986, gps: 39,
    lapRecord: { driver: 'Lewis Hamilton', time: '1:16.627', year: 2020 },
    about:   'Twisting Hungaroring brought F1 behind the Iron Curtain and rewards downforce above all else.',
    notable: 'The 1986 race drew over 200,000 fans, the largest crowd ever seen in communist Hungary. Fernando Alonso won here four times. Lewis Hamilton led every lap in 2020 to claim a record-equalling race win.',
    altitudeM: 264, weather: 'Hot & dry, 28–36°C, humidity builds mid-summer',
  },
  'Spa': {
    since: 1950, gps: 61,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:46.286', year: 2018 },
    about:   "Seven kilometres of Ardennes forest — Eau Rouge, Raidillon, Pouhon and Blanchimont define F1 at its most spectacular.",
    notable: "Often voted drivers' favourite circuit. Max Verstappen won from last in 2021 in a controversial half-points rain-shortened race. Thirteen different weather conditions can exist simultaneously across the lap.",
    altitudeM: 490, weather: 'Cool & unpredictable, 15–24°C, rain almost guaranteed',
  },
  'Zandvoort': {
    since: 1952, gps: 35,
    lapRecord: { driver: 'Max Verstappen', time: '1:11.097', year: 2023 },
    about:   "Banked Tarzan and Hugenholtz corners through the Dutch coastal dunes, rebuilt and reborn for the Verstappen era.",
    notable: 'Absent from the calendar 1985–2020 before Dutch fans drove its return. The Hugenholtz banking reaches 18 degrees, removing the normal racing line compromise. Capacity crowds of 105,000 turn it orange.',
    altitudeM: 5, weather: 'Cool & windy, 18–24°C, coastal gusts and showers',
  },
  'Monza': {
    since: 1950, gps: 74,
    lapRecord: { driver: 'Rubens Barrichello', time: '1:21.046', year: 2004 },
    about:   "Temple of Speed through the Royal Park north of Milan — the lowest downforce and highest average speed race of the year.",
    notable: "The most races ever held at any single F1 venue. Peter Gethin won in 1971 by 0.01 seconds — still the closest finish in F1 history. Slipstreaming determines strategy more here than anywhere else.",
    altitudeM: 162, weather: 'Warm & sunny, 24–30°C, occasional late-summer storms',
  },
  'Baku': {
    since: 2016, gps: 9,
    lapRecord: { driver: 'Charles Leclerc', time: '1:43.009', year: 2019 },
    about:   "Medieval Old City walls give way to the longest straight in F1 — 2.2 km along the Caspian Sea boulevard.",
    notable: "Sergio Pérez won from last in 2021 after Max Verstappen's tyre blew at 300 km/h with two laps to go. The circuit sits below sea level at −28 m. Safety cars appear in virtually every race.",
    altitudeM: -28, weather: 'Warm & breezy, 22–28°C, strong winds off the Caspian',
  },
  'Singapore': {
    since: 2008, gps: 17,
    lapRecord: { driver: 'Lewis Hamilton', time: '1:35.867', year: 2023 },
    about:   "F1's only night race — a floodlit street battle through Marina Bay that is the most physically demanding event on the calendar.",
    notable: "Fernando Alonso's Renault team infamously engineered a safety car via Nelson Piquet Jr.'s deliberate crash in 2008 — the Crashgate scandal. Drivers lose up to 3 kg in one race from heat and humidity.",
    altitudeM: 15, weather: 'Hot & humid, 30–34°C, heavy tropical downpours possible',
  },
  'Lusail': {
    since: 2021, gps: 4,
    lapRecord: { driver: 'Max Verstappen', time: '1:24.319', year: 2023 },
    about:   'High-speed floodlit desert circuit outside Doha with sweeping corners and little margin for error.',
    notable: 'Originally built for MotoGP in 2004 before F1 arrived. Max Verstappen won his second world title here in 2023. The circuit blends long radius corners with minimal low-speed sections.',
    altitudeM: 10, weather: 'Hot & dry, 28–35°C, cooler evenings under lights',
  },
  'Las Vegas': {
    since: 2023, gps: 2,
    lapRecord: { driver: 'Charles Leclerc', time: '1:35.490', year: 2023 },
    about:   'Night race down the Strip past the Bellagio and Caesars Palace — the most glamorous new venue on the modern calendar.',
    notable: 'A drain cover failure in practice 2023 destroyed Carlos Sainz\'s Ferrari floor. Las Vegas previously hosted a round in 1981–1982 in the Caesars Palace car park. The new race runs until 6 AM local time.',
    altitudeM: 620, weather: 'Cold nights, 4–12°C in November, clear and dry',
  },
  'Mexico City': {
    since: 1963, gps: 30,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:17.774', year: 2021 },
    about:   "At 2,285 m altitude the thin air forces unique downforce and engine maps — a vast stadium section roars when local heroes lead.",
    notable: "Max Verstappen broke the all-time single-season wins record here in 2023 with his 14th win. The thin air reduces downforce by ~20% and engine power by ~5%. Sergio Pérez is treated as a national hero at this race.",
    altitudeM: 2285, weather: 'Mild at altitude, 18–24°C, dry with cool evenings',
  },
  'São Paulo': {
    since: 1973, gps: 52,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:10.540', year: 2018 },
    about:   "Anti-clockwise Interlagos punishes late braking, delivers unpredictable rain and produces legendary championship moments.",
    notable: "Ayrton Senna's home race — he won here six times to the adulation of 100,000 Brazilian fans. Lewis Hamilton secured his 2008 title by one point on the final corner of the final lap. Rain is almost guaranteed.",
    altitudeM: 799, weather: 'Humid & rainy, 22–28°C, tropical storms highly likely',
  },
  'Sao Paulo': {
    since: 1973, gps: 52,
    lapRecord: { driver: 'Valtteri Bottas', time: '1:10.540', year: 2018 },
    about:   "Anti-clockwise Interlagos punishes late braking, delivers unpredictable rain and produces legendary championship moments.",
    notable: "Ayrton Senna's home race — he won here six times to the adulation of 100,000 Brazilian fans. Lewis Hamilton secured his 2008 title by one point on the final corner of the final lap. Rain is almost guaranteed.",
    altitudeM: 799, weather: 'Humid & rainy, 22–28°C, tropical storms highly likely',
  },
  'Abu Dhabi': {
    since: 2009, gps: 16,
    lapRecord: { driver: 'Max Verstappen', time: '1:26.103', year: 2021 },
    about:   "Season finale at Yas Marina — twilight start, floodlit finish, and the most dramatic final-lap championship decisions.",
    notable: "The 2021 finale saw Michael Masi controversially restart the race with one lap remaining, allowing Max Verstappen to pass Lewis Hamilton for the title. The circuit was substantially redesigned in 2021 to improve overtaking.",
    altitudeM: 7, weather: 'Hot & dry, 26–32°C, calm and clear evenings',
  },
  'Madrid': {
    since: 2026, gps: 0,
    lapRecord: null,
    about:   'Brand-new circuit in the IFEMA exhibition district on the outskirts of Madrid, giving Spain its second Grand Prix.',
    notable: 'The Madrid GP returns for the first time since the 1981 Spanish GP at Jarama. The new circuit was designed by Tilke Engineers and incorporates parts of the IFEMA convention centre complex.',
    altitudeM: 600, weather: 'Hot & dry, 28–36°C, very low humidity',
  },
}

const CIRCUIT_ALT: Record<string, number> = {
  'Monaco':        0.15,
  'Monte Carlo':   0.15,
  'Jeddah':        0.18,
  'Baku':          0.18,
  'Singapore':     0.18,
  'Las Vegas':     0.20,
  'Melbourne':     0.20,
  'Montreal':      0.20,
  'Montréal':      0.20,
  'Spa':           0.20,
  'Monza':         0.20,
  'Spielberg':     0.20,
  'Zandvoort':     0.19,
  'Imola':         0.22,
  'Barcelona':     0.22,
  'Silverstone':   0.22,
  'Budapest':      0.22,
  'Madrid':        0.22,
  'Austin':        0.22,
  'Bahrain':       0.22,
  'Suzuka':        0.22,
  'Shanghai':      0.22,
  'Miami':         0.22,
  'Miami Gardens': 0.22,
  'Lusail':        0.22,
  'Mexico City':   0.22,
  'São Paulo':     0.22,
  'Sao Paulo':     0.22,
  'Abu Dhabi':     0.22,
}

const NEARBY_LABELS: Record<string, Array<{ lat: number; lng: number; text: string }>> = {
  'Austin':        [{ lat: 30.2672, lng: -97.7431, text: 'Austin' },       { lat: 29.4241, lng: -98.4936, text: 'San Antonio' },  { lat: 30.2241, lng: -97.4742, text: 'Bastrop' }],
  'Bahrain':       [{ lat: 26.2285, lng: 50.5860,  text: 'Manama' },       { lat: 26.1297, lng: 50.5550,  text: 'Riffa' },         { lat: 26.2640, lng: 50.6110,  text: 'Muharraq' }],
  'Jeddah':        [{ lat: 21.4858, lng: 39.1925,  text: 'Jeddah' },       { lat: 21.3891, lng: 39.8579,  text: 'Mecca' },         { lat: 21.6066, lng: 39.1156,  text: 'Obhur' }],
  'Melbourne':     [{ lat: -37.8136, lng: 144.9631, text: 'Melbourne' },   { lat: -37.8676, lng: 144.9813, text: 'St Kilda' },     { lat: -37.9832, lng: 145.0023, text: 'Caulfield' }],
  'Suzuka':        [{ lat: 35.1815, lng: 136.9066, text: 'Nagoya' },       { lat: 34.9756, lng: 136.6243, text: 'Tsu' },           { lat: 34.7303, lng: 136.5086, text: 'Matsusaka' }],
  'Shanghai':      [{ lat: 31.2304, lng: 121.4737, text: 'Shanghai' },     { lat: 31.2988, lng: 120.5853, text: 'Suzhou' },        { lat: 31.8699, lng: 117.2800, text: 'Nanjing' }],
  'Miami':         [{ lat: 25.7907, lng: -80.1300, text: 'Miami Beach' },  { lat: 26.1224, lng: -80.1373, text: 'Ft Lauderdale' }, { lat: 25.7617, lng: -80.1918, text: 'Miami' }],
  'Miami Gardens': [{ lat: 25.7907, lng: -80.1300, text: 'Miami Beach' },  { lat: 26.1224, lng: -80.1373, text: 'Ft Lauderdale' }, { lat: 25.7617, lng: -80.1918, text: 'Miami' }],
  'Imola':         [{ lat: 44.4949, lng: 11.3426,  text: 'Bologna' },      { lat: 43.7696, lng: 11.2558,  text: 'Florence' },      { lat: 44.0647, lng: 12.5736,  text: 'Rimini' }],
  'Monaco':        [{ lat: 43.7102, lng: 7.2620,   text: 'Nice' },         { lat: 43.5528, lng: 7.0174,   text: 'Cannes' },        { lat: 43.8359, lng: 7.6561,   text: 'San Remo' }],
  'Monte Carlo':   [{ lat: 43.7102, lng: 7.2620,   text: 'Nice' },         { lat: 43.5528, lng: 7.0174,   text: 'Cannes' },        { lat: 43.8359, lng: 7.6561,   text: 'San Remo' }],
  'Montreal':      [{ lat: 45.5048, lng: -73.5544, text: 'Montreal' },     { lat: 45.5019, lng: -73.5674, text: 'Old Port' },      { lat: 45.4215, lng: -75.6919, text: 'Ottawa' }],
  'Montréal':      [{ lat: 45.5048, lng: -73.5544, text: 'Montreal' },     { lat: 45.5019, lng: -73.5674, text: 'Old Port' },      { lat: 45.4215, lng: -75.6919, text: 'Ottawa' }],
  'Barcelona':     [{ lat: 41.3851, lng: 2.1734,   text: 'Barcelona' },    { lat: 41.1189, lng: 1.2445,   text: 'Tarragona' },     { lat: 41.9794, lng: 2.8214,   text: 'Girona' }],
  'Spielberg':     [{ lat: 47.0707, lng: 15.4395,  text: 'Graz' },         { lat: 48.2082, lng: 16.3738,  text: 'Vienna' },        { lat: 47.7995, lng: 13.0440,  text: 'Salzburg' }],
  'Silverstone':   [{ lat: 51.5074, lng: -0.1278,  text: 'London' },       { lat: 51.7520, lng: -1.2577,  text: 'Oxford' },        { lat: 52.2405, lng: -0.9027,  text: 'Northampton' }],
  'Budapest':      [{ lat: 47.4979, lng: 19.0402,  text: 'Budapest' },     { lat: 48.1486, lng: 17.1077,  text: 'Bratislava' },    { lat: 48.2082, lng: 16.3738,  text: 'Vienna' }],
  'Spa':           [{ lat: 50.6326, lng: 5.5797,   text: 'Liège' },        { lat: 50.4669, lng: 4.8674,   text: 'Namur' },         { lat: 50.7753, lng: 6.0839,   text: 'Aachen' }],
  'Zandvoort':     [{ lat: 52.3676, lng: 4.9041,   text: 'Amsterdam' },    { lat: 52.3873, lng: 4.6462,   text: 'Haarlem' },       { lat: 52.0705, lng: 4.3007,   text: 'The Hague' }],
  'Monza':         [{ lat: 45.4654, lng: 9.1859,   text: 'Milan' },        { lat: 45.8081, lng: 9.0852,   text: 'Como' },          { lat: 45.6983, lng: 9.6773,   text: 'Bergamo' }],
  'Baku':          [{ lat: 40.4093, lng: 49.8671,  text: 'Baku' },         { lat: 40.3777, lng: 49.8920,  text: 'Old City' },      { lat: 40.3654, lng: 49.8402,  text: 'White City' }],
  'Singapore':     [{ lat: 1.3521,  lng: 103.8198, text: 'Singapore' },    { lat: 1.2904,  lng: 103.8520, text: 'Sentosa' },        { lat: 1.4053,  lng: 103.8678, text: 'Changi' }],
  'Lusail':        [{ lat: 25.2854, lng: 51.5310,  text: 'Doha' },         { lat: 25.1681, lng: 51.5964,  text: 'Al Wakrah' },     { lat: 25.6883, lng: 51.4958,  text: 'Al Khor' }],
  'Las Vegas':     [{ lat: 36.1699, lng: -115.1398, text: 'Downtown' },    { lat: 36.1147, lng: -115.1728, text: 'The Strip' },    { lat: 36.0395, lng: -114.9817, text: 'Henderson' }],
  'Mexico City':   [{ lat: 19.4326, lng: -99.1332, text: 'Mexico City' },  { lat: 19.0414, lng: -98.2063, text: 'Puebla' },        { lat: 19.2826, lng: -99.6557, text: 'Toluca' }],
  'São Paulo':     [{ lat: -23.5505, lng: -46.6333, text: 'São Paulo' },   { lat: -23.6620, lng: -46.5385, text: 'Santo André' },  { lat: -22.9099, lng: -47.0626, text: 'Campinas' }],
  'Sao Paulo':     [{ lat: -23.5505, lng: -46.6333, text: 'São Paulo' },   { lat: -23.6620, lng: -46.5385, text: 'Santo André' },  { lat: -22.9099, lng: -47.0626, text: 'Campinas' }],
  'Abu Dhabi':     [{ lat: 24.4539, lng: 54.3773,  text: 'Abu Dhabi' },    { lat: 25.2048, lng: 55.2708,  text: 'Dubai' },         { lat: 24.2075, lng: 55.7447,  text: 'Al Ain' }],
  'Madrid':        [{ lat: 40.4168, lng: -3.7038,  text: 'Madrid' },       { lat: 39.8628, lng: -4.0273,  text: 'Toledo' },        { lat: 40.9429, lng: -4.1088,  text: 'Segovia' }],
}

const FALLBACK_POV = { lat: 20, lng: 0, altitude: 2 }
const INITIAL_POV  = { lat: 20, lng: 10, altitude: 2 }
const FOCUSED_ALT  = 0.35
const GEOJSON_URL  = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'

// ─── GlobeView (memoised to isolate arc-fade animation from parent renders) ──

interface GlobeViewProps {
  allArcsData: any[]
  pointsData: any[]
  cityHtmlData: any[]
  focusedIdx: number
  focusedCircuit: string | null
  globeSize: { width: number; height: number }
  geoJson: any
  onGlobeReady: () => void
  globeRef: React.RefObject<any>
}

const GlobeView = memo(function GlobeView({
  allArcsData, pointsData, cityHtmlData,
  focusedIdx, focusedCircuit,
  globeSize, geoJson, onGlobeReady, globeRef,
}: GlobeViewProps) {
  const prevFocusedIdxRef = useRef(-1)
  const [outIdx, setOutIdx] = useState(-1)
  const [phase, setPhase] = useState(1)

  useEffect(() => {
    const prevIdx = prevFocusedIdxRef.current
    prevFocusedIdxRef.current = focusedIdx
    setOutIdx(prevIdx)
    setPhase(0)
    let rafId: number
    let start: number | null = null
    const tick = (ts: number) => {
      if (start === null) start = ts
      const t = Math.min((ts - start) / 450, 1)
      setPhase(t)
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [focusedIdx])

  return (
    // @ts-ignore
    <Globe
      ref={globeRef}
      width={globeSize.width}
      height={globeSize.height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl=""
      enablePointerInteraction={false}
      showAtmosphere={false}
      showGraticules={false}
      polygonsData={geoJson?.features?.filter((d: any) => d.properties.ISO_A2 !== 'AQ') ?? []}
      polygonGeoJsonGeometry="geometry"
      polygonCapColor={() => 'rgba(10,12,16,0.95)'}
      polygonSideColor={() => 'rgba(0,0,0,0)'}
      polygonStrokeColor={() => 'rgba(255,255,255,0.12)'}
      polygonAltitude={0.004}
      polygonsTransitionDuration={0}
      arcsData={allArcsData}
      arcColor={(d: any) => {
        const inRange  = focusedIdx !== -1 && d.fromIdx >= focusedIdx - 2 && d.fromIdx <= focusedIdx + 1
        const wasRange = outIdx     !== -1 && d.fromIdx >= outIdx     - 2 && d.fromIdx <= outIdx     + 1
        const base = d.done ? 0.18 : 0.55
        const rgb  = d.done ? '255,255,255' : '220,40,40'
        if (inRange && wasRange) return `rgba(${rgb},${base})`
        if (inRange)  return `rgba(${rgb},${base * phase})`
        if (wasRange) return `rgba(${rgb},${base * (1 - phase)})`
        return 'rgba(0,0,0,0)'
      }}
      arcStroke={0.25}
      arcsTransitionDuration={0}
      pointsData={pointsData}
      pointLat="lat"
      pointLng="lng"
      pointColor={(d: any) => d.circuit === focusedCircuit ? 'rgba(160,35,35,0.9)' : 'rgba(120,125,135,0.5)'}
      pointRadius={(d: any) => d.circuit === focusedCircuit ? 0.38 : 0.14}
      pointAltitude="altitude"
      pointResolution={8}
      pointsMerge={false}
      pointsTransitionDuration={0}
      onGlobeReady={onGlobeReady}
      htmlElementsData={cityHtmlData}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude="altitude"
      // @ts-ignore
      htmlElement={(d: any) => {
        const wrap = document.createElement('div')
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;'
        const dot = document.createElement('div')
        dot.style.cssText = 'width:2.5px;height:2.5px;border-radius:50%;background:rgba(255,255,255,0.45);flex-shrink:0;'
        const text = document.createElement('span')
        text.textContent = d.text.toUpperCase()
        text.style.cssText = 'font-family:var(--mono);font-size:6px;letter-spacing:0.12em;color:rgba(255,255,255,0.45);white-space:nowrap;'
        wrap.appendChild(dot)
        wrap.appendChild(text)
        return wrap
      }}
    />
  )
})

// ─── GlobeCalendar ────────────────────────────────────────────────────────────

export function GlobeCalendar({ weekends, now, imminentMeetingKey }: GlobeCalendarProps) {
  const { setMode } = useSessionStore()
  const globeRef    = useRef<any>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const globeReady  = useRef(false)
  // Pending circuit zoom requested before globe initialised
  const pendingCircuit = useRef<string | null>(null)
  // Tracks last active index to avoid redundant pointOfView calls on scroll
  const lastActiveIdx = useRef<number>(-1)
  // Tracks the last circuit we pointed to — readable by stable callbacks
  const currentCircuitRef = useRef<string | null>(null)

  const [geoJson, setGeoJson]         = useState<any>(null)
  const [globeSize, setGlobeSize]     = useState({ width: 600, height: 360 })
  const [focusedCircuit, setFocusedCircuit] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Fetch GeoJSON once ──
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => setGeoJson(data))
      .catch(() => {})
  }, [])

  // ── Track wrapper size ──
  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const w = Math.floor(entry.contentRect.width)
      setGlobeSize({ width: w, height: Math.round(w * 0.72) })
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Derived data ──

  const nextIndex = useMemo(() =>
    weekends.findIndex(w => {
      const r = w.sessions.find(s => s.session_type === 'Race')
      return r ? new Date(r.date_end).getTime() >= now - 10 * 60_000 : false
    }),
    [weekends, now]
  )

  const focusedIdx = useMemo(() =>
    focusedCircuit ? weekends.findIndex(w => w.circuitShort === focusedCircuit) : -1,
    [weekends, focusedCircuit]
  )

  // All consecutive race pairs — stable array; color/opacity controlled in GlobeView
  const allArcsData = useMemo(() =>
    weekends.slice(0, -1).flatMap((w, i) => {
      const a = CIRCUIT_COORDS[w.circuitShort]
      const b = CIRCUIT_COORDS[weekends[i + 1].circuitShort]
      if (!a || !b) return []
      const rs = w.sessions.find(s => s.session_type === 'Race')
      return [{ startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng,
                fromIdx: i, done: rs ? new Date(rs.date_end).getTime() < now - 10 * 60_000 : false }]
    }),
    [weekends, now]
  )

  // Stable points — geometry never rebuilt, color/size resolved per render in GlobeView
  const pointsData = useMemo(() =>
    weekends.flatMap(w => {
      const coords = CIRCUIT_COORDS[w.circuitShort]
      if (!coords) return []
      return [{ lat: coords.lat, lng: coords.lng, altitude: 0.01, circuit: w.circuitShort }]
    }),
    [weekends]
  )

  // City label HTML elements for focused circuit
  const cityHtmlData = useMemo(() =>
    (NEARBY_LABELS[focusedCircuit ?? ''] ?? []).map(l => ({
      lat: l.lat, lng: l.lng, altitude: 0.005, text: l.text,
    })),
    [focusedCircuit]
  )

  // ── Globe camera ──

  const pointTo = useCallback((circuitShort: string, durationMs = 800) => {
    if (!globeRef.current) return
    if (!globeReady.current) {
      pendingCircuit.current = circuitShort
      currentCircuitRef.current = circuitShort
      return
    }
    pendingCircuit.current = null
    currentCircuitRef.current = circuitShort
    setFocusedCircuit(circuitShort)
    const coords = CIRCUIT_COORDS[circuitShort]
    globeRef.current.pointOfView(
      coords ? { lat: coords.lat, lng: coords.lng, altitude: CIRCUIT_ALT[circuitShort] ?? FOCUSED_ALT } : FALLBACK_POV,
      durationMs
    )
  }, [setFocusedCircuit])

  const handleGlobeReady = useCallback(() => {
    globeReady.current = true
    if (!globeRef.current) return
    const mat = globeRef.current.globeMaterial?.()
    if (mat) mat.color?.setHex(0x0a0c10)
    // Prefer pending (queued before init), then last known circuit (e.g. after screen switch), then default
    const toCircuit = pendingCircuit.current ?? currentCircuitRef.current
    if (toCircuit) {
      const coords = CIRCUIT_COORDS[toCircuit]
      pendingCircuit.current = null
      setFocusedCircuit(toCircuit)
      globeRef.current.pointOfView(
        coords ? { lat: coords.lat, lng: coords.lng, altitude: CIRCUIT_ALT[toCircuit] ?? FOCUSED_ALT } : FALLBACK_POV,
        0
      )
    } else {
      globeRef.current.pointOfView(INITIAL_POV, 0)
    }
  }, [setFocusedCircuit])

  // ── Scroll → globe zoom (scrollend: fires once after snap animation finishes) ──
  // DOM order is reversed: domIdx 0 = last weekend, domIdx N-1 = first weekend.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || weekends.length === 0) return

    const onScrollEnd = () => {
      const h = scroller.clientHeight
      if (h === 0) return
      const domIdx = Math.round(scroller.scrollTop / h)
      if (domIdx === lastActiveIdx.current) return
      lastActiveIdx.current = domIdx
      const weekendIdx = weekends.length - 1 - domIdx
      const weekend = weekends[weekendIdx]
      if (weekend) pointTo(weekend.circuitShort)
    }

    scroller.addEventListener('scrollend', onScrollEnd, { passive: true })
    return () => scroller.removeEventListener('scrollend', onScrollEnd)
  }, [weekends, pointTo])

  // ── Auto-scroll to next race on mount ──
  // DOM is reversed so domIdx for nextIndex = weekends.length - 1 - nextIndex
  useEffect(() => {
    if (weekends.length === 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const realTarget = nextIndex >= 0 ? nextIndex : 0
    const domTarget = weekends.length - 1 - realTarget
    requestAnimationFrame(() => {
      if (!scroller) return
      const h = scroller.clientHeight
      if (h === 0) return
      scroller.scrollTo({ top: domTarget * h, behavior: 'instant' as ScrollBehavior })
      lastActiveIdx.current = domTarget
      const weekend = weekends[realTarget]
      if (weekend) pointTo(weekend.circuitShort)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekends.length > 0 ? 'ready' : 'loading'])


  if (weekends.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
        Loading calendar…
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Globe ── */}
      <div ref={wrapperRef} style={{ width: '100%', height: globeSize.height, flexShrink: 0,
                                     overflow: 'hidden', position: 'relative' }}>
        <GlobeView
          allArcsData={allArcsData}
          pointsData={pointsData}
          cityHtmlData={cityHtmlData}
          focusedIdx={focusedIdx}
          focusedCircuit={focusedCircuit}
          globeSize={globeSize}
          geoJson={geoJson}
          onGlobeReady={handleGlobeReady}
          globeRef={globeRef}
        />
        {/* Wheel interceptor — sits above canvas so Three.js stopPropagation can't swallow scroll */}
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          onWheel={(e) => { e.preventDefault(); scrollerRef.current?.scrollBy({ top: e.deltaY }) }}
        />
        {/* Edge vignette */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, transparent 45%, rgba(0,0,0,0.92) 100%)',
        }} />
      </div>

      {/* ── Vertical race sections ── */}
      <div
        ref={scrollerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          minHeight: 0,
        }}
      >
        {[...weekends].reverse().map((w, domIdx) => {
          const i             = weekends.length - 1 - domIdx
          const raceSession   = w.sessions.find(s => s.session_type === 'Race')
          const raceEnd       = raceSession ? new Date(raceSession.date_end).getTime() : 0
          const done          = raceEnd < now - 10 * 60_000
          const isNext        = i === nextIndex
          const isImminent    = w.meetingKey === imminentMeetingKey
          const trackSvg      = TRACK_SVG[w.circuitShort]
          const trackSvgUrl   = trackSvg ? `/seasons/2026/tracks/display/${trackSvg}.svg` : null
          const meta          = CIRCUIT_META[w.circuitShort]

          const raceDate = raceSession
            ? new Date(raceSession.date_start).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
            : null
          const raceTime = raceSession
            ? new Date(raceSession.date_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : null
          const history  = CIRCUIT_HISTORY[w.circuitShort] ?? null

          const sortedSessions = [...w.sessions].sort(
            (a, b) => (SESSION_META[a.session_type]?.order ?? 99) - (SESSION_META[b.session_type]?.order ?? 99)
          )

          return (
            <div
              key={w.meetingKey}
              onClick={isImminent ? () => setMode('live') : undefined}
              style={{
                flex: '0 0 100%',
                minHeight: 306,
                scrollSnapAlign: 'start',
                display: 'grid',
                gridTemplateColumns: trackSvgUrl ? '1fr 140px' : '1fr',
                gap: 0,
                padding: '14px 20px 14px',
                boxSizing: 'border-box',
                alignItems: 'start',
                opacity: done && !isNext ? 0.55 : 1,
                transition: 'opacity 0.2s',
                cursor: isImminent ? 'pointer' : 'default',
                borderTop: isNext
                  ? '1px solid rgba(232,19,43,0.25)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* ── Text column ── */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 7,
                overflow: 'clip', scrollbarWidth: 'none', minWidth: 0,
              }}>
                {/* Top block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

                  {/* Round + country */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 8.4, letterSpacing: '0.13em',
                      color: isNext ? 'rgba(232,19,43,0.8)' : 'rgba(255,255,255,0.38)',
                    }}>
                      R{w.roundNumber.toString().padStart(2, '0')}
                    </span>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 8.4, letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.32)', whiteSpace: 'nowrap',
                    }}>
                      {w.countryName.toUpperCase()}
                    </span>
                    {isImminent && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 7.4, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'rgba(232,19,43,0.85)',
                      }}>
                        → Go live
                      </span>
                    )}
                  </div>

                  {/* Circuit name */}
                  <div style={{
                    fontFamily: 'var(--cond)', fontSize: 27.3, fontWeight: 700,
                    letterSpacing: '0.01em', lineHeight: 1,
                    color: done && !isNext ? 'rgba(255,255,255,0.55)' : '#fff',
                    whiteSpace: 'nowrap',
                  }}>
                    {w.circuitShort}
                  </div>

                  {/* Full circuit name + circuit type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {CIRCUIT_FULL_NAME[w.circuitShort] && (
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 8.4, letterSpacing: '0.04em',
                        color: done ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.52)',
                        whiteSpace: 'nowrap',
                      }}>
                        {CIRCUIT_FULL_NAME[w.circuitShort]}
                      </div>
                    )}
                    {meta && (
                      <div style={{
                        fontFamily: 'var(--mono)', fontSize: 6.3, letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: meta.type === 'street'
                          ? 'rgba(80,180,255,0.85)'
                          : meta.type === 'semi-permanent'
                            ? 'rgba(224,144,0,0.75)'
                            : 'rgba(255,255,255,0.38)',
                        border: `0.5px solid ${
                          meta.type === 'street'
                            ? 'rgba(80,180,255,0.35)'
                            : meta.type === 'semi-permanent'
                              ? 'rgba(224,144,0,0.32)'
                              : 'rgba(255,255,255,0.15)'
                        }`,
                        borderRadius: 2,
                        padding: '1px 4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {meta.type === 'semi-permanent' ? 'Semi-Perm' : meta.type}
                      </div>
                    )}
                  </div>

                  {/* About text */}
                  {history?.about && (
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 7.9, lineHeight: 1.58,
                      color: done ? 'rgba(255,255,255,0.25)' : isNext ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.42)',
                      maxWidth: 290,
                    }}>
                      {history.about}
                    </div>
                  )}
                </div>

                {/* Session chips — horizontal */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {sortedSessions.map(s => {
                    const sm      = SESSION_META[s.session_type] ?? { label: '?', color: 'rgba(120,120,120,0.5)', order: 99 }
                    const sEnd    = new Date(s.date_end).getTime()
                    const sStart  = new Date(s.date_start).getTime()
                    const sDone   = sEnd < now - 10 * 60_000
                    const sActive = sStart <= now && sEnd >= now - 10 * 60_000
                    return (
                      <div key={s.session_key} title={s.session_type} style={{
                        width: 22, height: 18, borderRadius: 2,
                        background: sDone || sActive ? sm.color : 'rgba(255,255,255,0.06)',
                        border: `0.5px solid ${sDone || sActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                        boxShadow: sActive ? `0 0 6px ${sm.color}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: sDone ? 0.45 : 1,
                      }}>
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: 6.3, fontWeight: 700, lineHeight: 1,
                          color: sDone || sActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.22)',
                        }}>
                          {sm.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Circuit stats */}
                {meta && (
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {[
                      { label: 'LAPS',  value: String(meta.laps) },
                      { label: 'KM',    value: meta.km.toFixed(3) },
                      { label: 'TURNS', value: String(meta.turns) },
                      { label: 'DRS',   value: String(meta.drs) },
                      { label: 'DIST',  value: `${(meta.laps * meta.km).toFixed(0)} km` },
                      ...(history ? [{ label: 'ALT', value: `${history.altitudeM < 0 ? '' : ''}${history.altitudeM} m` }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 6.3, letterSpacing: '0.1em',
                                       color: 'rgba(255,255,255,0.32)' }}>{label}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700,
                                       color: isNext ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.6)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom block: history / record / weather / date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>


                  {/* History row */}
                  {history && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: 'var(--mono)', fontSize: 8.4, letterSpacing: '0.06em',
                      color: 'rgba(255,255,255,0.35)',
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Since</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>{history.since}</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>{history.gps > 0 ? `${history.gps}×` : 'Debut'}</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>·</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>GP</span>
                    </div>
                  )}

                  {/* Lap record */}
                  {history?.lapRecord && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      fontFamily: 'var(--mono)', fontSize: 8.4, letterSpacing: '0.04em',
                      color: 'rgba(255,255,255,0.45)',
                    }}>
                      <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Record</span>
                      <span style={{
                        color: isNext ? 'rgba(255,210,80,0.95)' : 'rgba(255,210,80,0.62)',
                        fontWeight: 700, letterSpacing: '0.02em',
                      }}>
                        {history.lapRecord.time}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
                      <span style={{ color: 'rgba(255,255,255,0.72)' }}>{history.lapRecord.driver}</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
                      <span style={{ color: 'rgba(255,255,255,0.72)' }}>{history.lapRecord.year}</span>
                    </div>
                  )}

                  {/* Notable fact */}
                  {history?.notable && (
                    <div style={{
                      fontFamily: 'var(--mono)', fontSize: 8.9, lineHeight: 1.58,
                      color: done ? 'rgba(255, 255, 255, 0.48)' : isNext ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.78)',
                      maxWidth: 290,
                      borderLeft: `1.5px solid ${isNext ? 'rgba(232,19,43,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      paddingLeft: 8,
                    }}>
                      {history.notable}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Track SVG ── */}
              {trackSvgUrl && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingLeft: 10, opacity: done && !isNext ? 0.2 : isNext ? 0.9 : 0.55,
                  height: '100%',
                  transition: 'opacity 0.8s',
                  alignSelf: 'stretch',
                }}>
                  <img
                    src={trackSvgUrl}
                    alt={w.circuitShort}
                    style={{ width: 130, height: 'auto', maxHeight: 160, objectFit: 'contain',
                             filter: 'brightness(0) invert(1)' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Session type legend */}
      <div style={{
        flexShrink: 0,
        padding: '7px 20px 9px',
        borderTop: '0.5px solid rgba(255,255,255,0.05)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'P1', full: 'Practice 1',        color: 'rgba(160,168,180,0.7)' },
          { label: 'P2', full: 'Practice 2',        color: 'rgba(160,168,180,0.7)' },
          { label: 'P3', full: 'Practice 3',        color: 'rgba(160,168,180,0.7)' },
          { label: 'SQ', full: 'Sprint Qualifying', color: 'rgba(224,144,0,0.8)' },
          { label: 'S',  full: 'Sprint',            color: 'rgba(255,120,0,0.85)' },
          { label: 'Q',  full: 'Qualifying',        color: 'rgba(80,140,255,0.85)' },
          { label: 'R',  full: 'Race',              color: 'rgba(232,19,43,0.9)' },
        ].map(({ label, full, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 18, height: 14, borderRadius: 2, flexShrink: 0,
              background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 6, fontWeight: 700, lineHeight: 1,
                color: 'rgba(255,255,255,0.92)',
              }}>
                {label}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap',
            }}>
              {full}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
