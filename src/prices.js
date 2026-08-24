// 웹사이트 reservation.html의 PRICES 객체와 반드시 같은 값으로 유지해야 합니다.
export const PRICES = {
  PH: { VF: 5820, F: 3300, R: 2520, T: 1620 },
  FOREIGN: { VF: 5820, F: 3600, R: 2820, T: 1920 },
};

// index.html의 pkg-card 섹션과 같은 이름/태그/사진(assets/pkg-*.png)입니다.
export const TOURS = [
  {
    code: "VF",
    name: "VIP Fast Track",
    tag: "PREMIUM · PRIVATE",
    desc: "Private vehicle + dedicated photographer",
    image: require("../assets/images/pkg-vip.jpg"),
  },
  {
    code: "F",
    name: "Fast Track",
    tag: "⭐ MOST POPULAR",
    desc: "All-inclusive, minimal waiting",
    image: require("../assets/images/pkg-fast.jpg"),
  },
  {
    code: "R",
    name: "Regular Tour",
    tag: "GREAT VALUE",
    desc: "Classic whale shark experience",
    image: require("../assets/images/pkg-regular.jpg"),
  },
  {
    code: "T",
    name: "Ticket Only",
    tag: "TICKET ONLY",
    desc: "Admission ticket only, no transport",
    image: require("../assets/images/pkg-ticket.jpg"),
  },
];
