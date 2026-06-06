export interface RESPONSE_COMPATIBILITY_LOVE_GET {
  me: {
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
  },
you: {
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
  }, 
  result: {
    score: number;
    rating: {
      rating: number;
      note: string;
    },
    desc: {
      note: string;
    }[]
  }
  /*
 score: 11.6667,
  rating: CompatibilityLoveRating {
    id: 10,
    start_score: 0,
    end_score: 16.67,
    rating: 1,
    note: 'ความรักค่อนข้างไม่ปลอดภัย ทั้งในแง่จิตใจและร่างกาย อาจต้องเจอเรื่องผิดหวัง ไม่สามารถพัฒนาความสัมพันธ์ต่อไปได้'
  },
  desc: [
    { note: 'เป็นคนรักที่มีความเสน่หาต่อกัน สร้างความน่าหลงใหลต่อกัน' },
    {
      note: 'จะมีความสัมพันธ์ที่อาจไม่ได้จัดงานแต่งแบบพิธีใหญ่โต ชอบอยู่ด้วยกันแบบเรียบง่าย ไม่เน้นพิธีการ'
    },
    {
      note: 'ความสัมพันธ์ เร้าร้อน รุนแรง ทะเลาะวิวาท บาดเจ็บ และพลัดพราก'
    }
  ]
  */
}