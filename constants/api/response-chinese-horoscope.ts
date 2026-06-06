export interface RESPONSE_CHINESE_HOROSCOPE_GET {
  dob: string
  time: string
  gender: string
  name: string
  "summary": {
      "element":  string
      "power":  string
      "yearAbove":  string
      "yearBelow":  string
      "monthAbove":  string
      "monthBelow": string
      "dayAbove":  string
      "dayBelow":  string
      "timeAbove":  string,
      "timeBelow":  string
  },
  "detail": {
      "yearAbove": {
          "id": number,
          "chinese_symbol":  string
          "pronunciation":  string
          "element":  string
          "power":  string
          "direction":  string
          "color":  string
      },
      "yearBelow": {
          "id": 12,
          "chinese_symbol": "亥",
          "pronunciation": "ไห",
          "element": "WATER",
          "power": "YIN",
          "direction": "NORTHWEST",
          "color": "BLUE",
          "constellation": "PIG"
      },
      "monthAbove": {
        "id": number,
        "chinese_symbol":  string
        "pronunciation":  string
        "element":  string
        "power":  string
        "direction":  string
        "color":  string
      },
      "monthBelow": {
          "id": number,
          "chinese_symbol":string
          "pronunciation":string
          "element": string
          "power":string
          "direction": string
          "color":string
          "constellation": string
      },
      "dayAbove": {
        "id": number,
        "chinese_symbol":  string
        "pronunciation":  string
        "element":  string
        "power":  string
        "direction":  string
        "color":  string
      },
      "dayBelow": {
        "id": number,
        "chinese_symbol":string
        "pronunciation":string
        "element": string
        "power":string
        "direction": string
        "color":string
        "constellation": string
      },
      "timeAbove": {
        "id": number,
        "chinese_symbol":  string
        "pronunciation":  string
        "element":  string
        "power":  string
        "direction":  string
        "color":  string
      },
      "timeBelow": {
        "id": number,
        "chinese_symbol":string
        "pronunciation":string
        "element": string
        "power":string
        "direction": string
        "color":string
        "constellation": string
      }
  },
  "analytic": {
        "base": {
            "element": string;
            "description": string;
        },
        "elemental_characteristics": {
            "element": string;
            "level": string;
            "remark": string;
            "description": string;
        },
        "habits_behaviors": {
                "element": string;
                "level": string;
                "sequence": number;
                "note": string;
        }[],
        "occupations": {
                "element": string;
                "level": string;
                "sequence": number;
                "note": string;
        }[],
        "lucky_colors": {
                "element": string;
                "level": string;
                "sequence": number;
                "note": string;
        }[],
        "sacred_things": {
                "element": string;
                "level": string;
                "sequence": number;
                "note": string;
        }[],
        love: {
          note_above: string;
          note_below: string;
        }
    }
}