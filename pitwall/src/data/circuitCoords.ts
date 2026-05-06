export interface CircuitCoord {
  lat: number
  lng: number
}

export const CIRCUIT_COORDS: Record<string, CircuitCoord> = {
  // circuitShort (matches OpenF1 circuit_short_name) → lat/lng of the circuit
  'Bahrain':      { lat: 26.0325,  lng: 50.5106  },
  'Jeddah':       { lat: 21.6319,  lng: 39.1044  },
  'Melbourne':    { lat: -37.8497, lng: 144.9680 },
  'Suzuka':       { lat: 34.8431,  lng: 136.5407 },
  'Shanghai':     { lat: 31.3389,  lng: 121.2199 },
  'Miami':        { lat: 25.9582,  lng: -80.2389 },
  'Miami Gardens': { lat: 25.9582,  lng: -80.2389 },
  'Imola':        { lat: 44.3439,  lng: 11.7167  },
  'Monaco':       { lat: 43.7347,  lng: 7.4205   },
  'Monte Carlo':  { lat: 43.7347,  lng: 7.4205   },
  'Montreal':     { lat: 45.5000,  lng: -73.5228 },
  'Montréal':     { lat: 45.5000,  lng: -73.5228 },
  'Barcelona':    { lat: 41.5700,  lng: 2.2611   },
  'Spielberg':    { lat: 47.2197,  lng: 14.7647  },
  'Silverstone':  { lat: 52.0786,  lng: -1.0169  },
  'Budapest':     { lat: 47.5789,  lng: 19.2486  },
  'Spa':          { lat: 50.4372,  lng: 5.9714   },
  'Zandvoort':    { lat: 52.3888,  lng: 4.5408   },
  'Monza':        { lat: 45.6156,  lng: 9.2811   },
  'Baku':         { lat: 40.3725,  lng: 49.8533  },
  'Singapore':    { lat: 1.2914,   lng: 103.8640 },
  'Austin':       { lat: 30.1328,  lng: -97.6411 },
  'Mexico City':  { lat: 19.4042,  lng: -99.0907 },
  'São Paulo':    { lat: -23.7036, lng: -46.6997 },
  'Sao Paulo':    { lat: -23.7036, lng: -46.6997 },
  'Las Vegas':    { lat: 36.1147,  lng: -115.1728 },
  'Lusail':       { lat: 25.4900,  lng: 51.4542  },
  'Abu Dhabi':    { lat: 24.4672,  lng: 54.6031  },
  'Madrid':       { lat: 40.3517,  lng: -3.7013  },
}
