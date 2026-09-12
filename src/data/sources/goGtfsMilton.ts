// src/data/sources/goGtfsMilton.ts
// GENERATED, do not hand-edit. Re-run: GTFS_DIR=<feed dir> node scripts/gtfs/milton-go.mjs
//
// Source : Metrolinx GTFS feed, version 20260910145058
//          valid 20260910 to 20261127, 79 dated services
// Computed : 2026-09-11
// Stops    : ML (Milton GO), 00194 (Milton GO Bus),
//            UN (Union Station GO), 02300 (Union Station Bus Terminal)
//
// Times are GTFS service-day times: "24:25" is 12:25 a.m. on the following calendar day.
// A "weekday" is the pattern most Monday-to-Friday dates in the feed share, a "weekend" the
// pattern most Saturday and Sunday dates share; `exceptions` lists every date that matches
// neither, with what it carries instead.

export const GO_GTFS_MILTON = {
  "feed": {
    "publisher": "Metrolinx",
    "publisherUrl": "https://www.metrolinx.com",
    "version": "20260910145058",
    "startDate": "20260910",
    "endDate": "20261127",
    "computedOn": "2026-09-11",
    "serviceDates": 79,
    "firstServiceDate": "20260910",
    "lastServiceDate": "20261127"
  },
  "stops": {
    "miltonRail": "Milton GO",
    "miltonBus": "Milton GO Bus",
    "unionRail": "Union Station GO",
    "unionBus": "Union Station Bus Terminal"
  },
  "fare": {
    "miltonToUnion": {
      "fareId": "24-02",
      "price": 12.25,
      "currency": "CAD",
      "fromZone": "24",
      "toZone": "02"
    },
    "unionToMilton": {
      "fareId": "02-24",
      "price": 12.25,
      "currency": "CAD",
      "fromZone": "02",
      "toZone": "24"
    }
  },
  "weekday": {
    "dates": 56,
    "trainsToUnion": {
      "n": 10,
      "first": {
        "dep": "06:00",
        "arr": "07:03"
      },
      "last": {
        "dep": "08:30",
        "arr": "09:33"
      },
      "minsTypical": 63,
      "minsMin": 63,
      "minsMax": 63,
      "via": [
        "Lisgar GO",
        "Meadowvale GO",
        "Streetsville GO",
        "Erindale GO",
        "Cooksville GO",
        "Dixie GO",
        "Kipling GO"
      ],
      "legs": [
        {
          "dep": "06:00",
          "arr": "07:03",
          "mins": 63
        },
        {
          "dep": "06:30",
          "arr": "07:33",
          "mins": 63
        },
        {
          "dep": "06:45",
          "arr": "07:48",
          "mins": 63
        },
        {
          "dep": "07:00",
          "arr": "08:03",
          "mins": 63
        },
        {
          "dep": "07:15",
          "arr": "08:18",
          "mins": 63
        },
        {
          "dep": "07:30",
          "arr": "08:33",
          "mins": 63
        },
        {
          "dep": "07:45",
          "arr": "08:48",
          "mins": 63
        },
        {
          "dep": "08:00",
          "arr": "09:03",
          "mins": 63
        },
        {
          "dep": "08:15",
          "arr": "09:18",
          "mins": 63
        },
        {
          "dep": "08:30",
          "arr": "09:33",
          "mins": 63
        }
      ]
    },
    "trainsFromUnion": {
      "n": 10,
      "first": {
        "dep": "15:40",
        "arr": "16:40"
      },
      "last": {
        "dep": "19:10",
        "arr": "20:10"
      },
      "minsTypical": 60,
      "minsMin": 60,
      "minsMax": 60,
      "legs": [
        {
          "dep": "15:40",
          "arr": "16:40",
          "mins": 60
        },
        {
          "dep": "16:10",
          "arr": "17:10",
          "mins": 60
        },
        {
          "dep": "16:25",
          "arr": "17:25",
          "mins": 60
        },
        {
          "dep": "16:40",
          "arr": "17:40",
          "mins": 60
        },
        {
          "dep": "16:55",
          "arr": "17:55",
          "mins": 60
        },
        {
          "dep": "17:10",
          "arr": "18:10",
          "mins": 60
        },
        {
          "dep": "17:25",
          "arr": "18:25",
          "mins": 60
        },
        {
          "dep": "17:55",
          "arr": "18:55",
          "mins": 60
        },
        {
          "dep": "18:25",
          "arr": "19:25",
          "mins": 60
        },
        {
          "dep": "19:10",
          "arr": "20:10",
          "mins": 60
        }
      ]
    },
    "busesToUnion": {
      "n": 26,
      "first": {
        "dep": "03:45",
        "arr": "05:25"
      },
      "last": {
        "dep": "24:25",
        "arr": "26:00"
      },
      "minsTypical": 93,
      "minsMin": 75,
      "minsMax": 160,
      "legs": [
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "03:45",
          "arr": "05:25",
          "mins": 100
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "04:20",
          "arr": "06:05",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "04:45",
          "arr": "06:35",
          "mins": 110
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "09:00",
          "arr": "10:25",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "09:20",
          "arr": "10:45",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "09:40",
          "arr": "11:05",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "10:05",
          "arr": "11:30",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "10:20",
          "arr": "11:40",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "10:40",
          "arr": "12:00",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "11:00",
          "arr": "12:20",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "11:20",
          "arr": "12:40",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "11:50",
          "arr": "13:10",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "12:20",
          "arr": "13:35",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "12:50",
          "arr": "14:05",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "13:20",
          "arr": "14:45",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "14:15",
          "arr": "15:45",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "15:15",
          "arr": "16:55",
          "mins": 100
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "16:10",
          "arr": "18:50",
          "mins": 160
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "17:15",
          "arr": "19:40",
          "mins": 145
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "18:10",
          "arr": "20:25",
          "mins": 135
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "19:10",
          "arr": "21:20",
          "mins": 130
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "20:10",
          "arr": "22:15",
          "mins": 125
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "21:15",
          "arr": "23:10",
          "mins": 115
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "22:15",
          "arr": "24:00",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "23:15",
          "arr": "25:00",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Union Station",
          "dep": "24:25",
          "arr": "26:00",
          "mins": 95
        }
      ]
    },
    "busesFromUnion": {
      "n": 22,
      "first": {
        "dep": "05:40",
        "arr": "07:30"
      },
      "last": {
        "dep": "26:20",
        "arr": "27:50"
      },
      "minsTypical": 85,
      "minsMin": 65,
      "minsMax": 135,
      "legs": [
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "05:40",
          "arr": "07:30",
          "mins": 110
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "06:45",
          "arr": "08:50",
          "mins": 125
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "07:50",
          "arr": "10:05",
          "mins": 135
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "08:50",
          "arr": "11:00",
          "mins": 130
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "09:55",
          "arr": "12:00",
          "mins": 125
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "11:00",
          "arr": "12:15",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "12:00",
          "arr": "13:15",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "12:25",
          "arr": "13:40",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "12:50",
          "arr": "14:10",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "13:10",
          "arr": "14:40",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "13:35",
          "arr": "15:05",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "14:45",
          "arr": "16:35",
          "mins": 110
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "19:35",
          "arr": "20:50",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "20:05",
          "arr": "21:20",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "20:40",
          "arr": "21:50",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "21:05",
          "arr": "22:15",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "21:40",
          "arr": "22:50",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "22:40",
          "arr": "23:50",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "23:35",
          "arr": "24:40",
          "mins": 65
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "24:20",
          "arr": "26:00",
          "mins": 100
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "25:20",
          "arr": "26:50",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21 - Milton GO",
          "dep": "26:20",
          "arr": "27:50",
          "mins": 90
        }
      ]
    },
    "otherBuses": [
      {
        "route": "27",
        "name": "Milton / North York",
        "n": 18,
        "first": "05:05",
        "last": "18:25",
        "destinations": [
          "Finch Bus Terminal"
        ]
      },
      {
        "route": "22",
        "name": "Milton / Oakville",
        "n": 16,
        "first": "07:04",
        "last": "21:55",
        "destinations": [
          "Oakville GO Bus",
          "Regional Rd. 25 @ Hwy. 401 Park & Ride"
        ]
      }
    ]
  },
  "weekend": {
    "dates": 22,
    "trainsToUnion": {
      "n": 0,
      "first": null,
      "last": null,
      "minsTypical": null,
      "minsMin": null,
      "minsMax": null,
      "via": [],
      "legs": []
    },
    "trainsFromUnion": {
      "n": 0,
      "first": null,
      "last": null,
      "minsTypical": null,
      "minsMin": null,
      "minsMax": null,
      "legs": []
    },
    "busesToUnion": {
      "n": 21,
      "first": {
        "dep": "04:55",
        "arr": "06:25"
      },
      "last": {
        "dep": "24:25",
        "arr": "26:00"
      },
      "minsTypical": 90,
      "minsMin": 65,
      "minsMax": 120,
      "legs": [
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "04:55",
          "arr": "06:25",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "05:55",
          "arr": "07:25",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "06:25",
          "arr": "08:05",
          "mins": 100
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "07:30",
          "arr": "08:35",
          "mins": 65
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "08:30",
          "arr": "09:40",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "09:30",
          "arr": "10:40",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "10:20",
          "arr": "11:40",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "11:25",
          "arr": "12:50",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "12:25",
          "arr": "13:55",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "13:25",
          "arr": "14:55",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "14:25",
          "arr": "15:55",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "15:25",
          "arr": "16:55",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "16:20",
          "arr": "17:55",
          "mins": 95
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "17:20",
          "arr": "18:50",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Union Station",
          "dep": "18:25",
          "arr": "19:50",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "19:25",
          "arr": "21:25",
          "mins": 120
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "20:20",
          "arr": "22:20",
          "mins": 120
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "21:25",
          "arr": "23:10",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "22:20",
          "arr": "24:00",
          "mins": 100
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "23:25",
          "arr": "25:00",
          "mins": 95
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Union Station",
          "dep": "24:25",
          "arr": "26:00",
          "mins": 95
        }
      ]
    },
    "busesFromUnion": {
      "n": 20,
      "first": {
        "dep": "07:20",
        "arr": "09:05"
      },
      "last": {
        "dep": "26:20",
        "arr": "27:50"
      },
      "minsTypical": 80,
      "minsMin": 70,
      "minsMax": 120,
      "legs": [
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "07:20",
          "arr": "09:05",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "08:20",
          "arr": "10:05",
          "mins": 105
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "09:10",
          "arr": "11:00",
          "mins": 110
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "10:10",
          "arr": "12:10",
          "mins": 120
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "11:50",
          "arr": "13:10",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "13:00",
          "arr": "14:20",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "14:05",
          "arr": "15:25",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "14:55",
          "arr": "16:15",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "16:00",
          "arr": "17:20",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "17:05",
          "arr": "18:30",
          "mins": 85
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "18:05",
          "arr": "19:25",
          "mins": 80
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "19:00",
          "arr": "20:15",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "19:55",
          "arr": "21:10",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "20:55",
          "arr": "22:10",
          "mins": 75
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "22:00",
          "arr": "23:10",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "22:55",
          "arr": "24:05",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21A - Milton GO",
          "dep": "23:55",
          "arr": "25:05",
          "mins": 70
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "24:20",
          "arr": "25:55",
          "mins": 95
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "25:20",
          "arr": "26:50",
          "mins": 90
        },
        {
          "route": "21",
          "name": "Milton",
          "headsign": "21F - Milton GO",
          "dep": "26:20",
          "arr": "27:50",
          "mins": 90
        }
      ]
    },
    "otherBuses": [
      {
        "route": "27",
        "name": "Milton / North York",
        "n": 1,
        "first": "05:35",
        "last": "05:35",
        "destinations": [
          "Finch Bus Terminal"
        ]
      }
    ]
  },
  "exceptions": [
    {
      "date": "20261012",
      "dow": "Mon",
      "trainsMatch": "weekday",
      "busesMatch": "weekend",
      "trainsToUnion": 10,
      "busesToUnion": 21
    }
  ]
} as const;
