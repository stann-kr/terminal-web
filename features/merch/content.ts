/**
 * TERMINAL merch: static content, one entry per piece, tagged with the session it was made for.
 * Images are the vendor mockups on the public media host (the same files the SIGNAL mail used).
 */
export interface MerchImage {
  src: string;
  alt: string;
  /** Short printed label under a thumbnail. */
  label: string;
}

export interface MerchItem {
  id: string;
  /** The session the piece was made for (`TRM-03`). */
  eventId: string;
  edition: string;
  name: string;
  price: string;
  /** The home tile's one line: price and where it is sold. */
  sale: string;
  /** The open plate's lead image, then the rest. */
  images: readonly [MerchImage, ...MerchImage[]];
  /** Each size and its measurements, cm. */
  sizes: readonly (readonly [string, string])[];
  facts: readonly (readonly [string, string])[];
  story: { ko: readonly string[]; en: readonly string[] };
  /** How to buy, in the order to try: on site first. */
  buy: readonly { label: string; title: string; text: string }[];
  dm: { handle: string; href: string };
}

const MEDIA = 'https://media.stann.kr/terminal';

export const merch: readonly MerchItem[] = [
  {
    id: 'signal-tee',
    eventId: 'TRM-03',
    edition: '[03] LIMITED',
    name: 'Signal Tee',
    price: '35,000원',
    sale: '35,000원 · 11.28 인포 현장 판매',
    images: [
      { src: `${MEDIA}/TRM-03-signal-tee-detail.jpg`, alt: 'Signal Tee 뒷면 펄스 프린트 클로즈업', label: 'BACK · DETAIL' },
      { src: `${MEDIA}/TRM-03-signal-tee-front.jpg`, alt: 'Signal Tee 앞면, 왼쪽 가슴 TERMINAL 로고', label: 'FRONT · LEFT CHEST' },
      { src: `${MEDIA}/TRM-03-signal-tee-back.jpg`, alt: 'Signal Tee 뒷면, 등 중앙 펄스 그래픽', label: 'BACK · CENTER' },
    ],
    sizes: [
      ['L', '가슴 55 / 총장 74'],
      ['XL', '가슴 58 / 총장 78'],
    ],
    // Price and edition stand in the page's head.
    facts: [
      ['색', 'BLACK'],
      ['원단', 'HEAVY COTTON 7.4 OZ (14수)'],
      ['인쇄', 'WHITE + AMBER'],
    ],
    story: {
      ko: [
        '1967년 11월 28일, 여우자리에서 처음 기록된 펄서 신호 PSR B1919+21.',
        '그 펄스를 재해석한 그래픽을 등판에 담고, 앞면 왼쪽 가슴에는 TERMINAL 로고 하나만 넣었습니다. 원단은 두툼하고 탄탄한 7.4온스 헤비 코튼(14수)입니다.',
      ],
      en: [
        'PSR B1919+21, the first pulsar ever recorded, was caught in Vulpecula on 28 November 1967.',
        'Its pulse is reinterpreted across the back, with a single TERMINAL mark on the left chest. Cut from heavy 7.4 oz cotton.',
      ],
    },
    buy: [
      { label: 'ON SITE', title: '현장 판매', text: '11월 28일(토) 23:00부터 FAUST SEOUL 인포에서 구매하실 수 있습니다. 결제는 계좌이체입니다.' },
      { label: 'DM', title: '인스타그램 DM', text: '현장에 오시기 어려우면 인스타그램 @terminal.signal로 원하시는 사이즈를 보내 주십시오.' },
    ],
    dm: { handle: '@terminal.signal', href: 'https://ig.me/m/terminal.signal' },
  },
];

/** The merch made for a session, if any. */
export function merchFor(eventId: string): readonly MerchItem[] {
  return merch.filter(item => item.eventId === eventId);
}
