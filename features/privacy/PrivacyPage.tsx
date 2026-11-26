import { PageHeading, ui } from '@/features/ui/Ui';
import styles from './privacy.module.css';

/** Who may be asked about one's records (the policy's contact): mail first, the Instagram DM beside it. */
export const PRIVACY_EMAIL = 'terminal@stann.kr';
export const PRIVACY_INSTAGRAM = { label: '@terminal.signal', href: 'https://www.instagram.com/terminal.signal/' };
export const PRIVACY_EFFECTIVE = '2026-11-26';

/** What each form keeps: the items, why, and for how long. */
const RECORDS = [
  ['게스트 신청', '이름, 인스타그램 ID(적은 경우)', '게스트 입장 관리', '이벤트 종료 후 1개월'],
  ['게스트 대기 명단', '이름, 인스타그램 ID', '대기 명단 관리와 아티스트의 연락', '이벤트 종료 후 1개월'],
  ['게스트 신청의 소식 수신(선택)', '이메일', '다음 이벤트 소식 안내', '수신 거부 시까지'],
  ['소식 신청', '이메일, 인스타그램 ID(적은 경우)', '이벤트 소식 안내', '수신 거부 시까지'],
  ['방문자 로그', '메시지, 공개 닉네임(적은 경우)', '공개 로그 게시', '삭제를 요청하실 때까지 공개'],
  ['접속 기록(위 입력 공통)', '지역(국가·지역·도시), 통신사, 암호화한 IP, 브라우저·OS·기기, 유입 경로', '악용 방지와 운영 확인', '90일, 공개하지 않음'],
] as const;

/** The site's privacy policy as one page of plain sections. */
export function PrivacyPage() {
  return (
    <div className={styles.page}>
      <PageHeading title="개인정보처리방침" />
      <header className={styles.head} data-surface="inset">
        <span className={styles.headLabel} aria-hidden="true">PRIVACY</span>
        <span className={styles.headKo}>개인정보처리방침</span>
        <span className={styles.headDate}>시행일 {PRIVACY_EFFECTIVE}</span>
      </header>
      <article className={styles.sheet} data-surface="paper">
        <p className={styles.lead}>
          TERMINAL은 이벤트 운영에 필요한 만큼만 개인정보를 받고, 아래 목적과 기간 안에서만 씁니다.
        </p>

        <section aria-labelledby="privacy-items">
          <h2 id="privacy-items">1. 받는 정보와 목적, 보관 기간</h2>
          <ul className={styles.records}>
            {RECORDS.map(([where, items, purpose, period]) => (
              <li key={where}>
                <h3>{where}</h3>
                <dl>
                  <div><dt>항목</dt><dd>{items}</dd></div>
                  <div><dt>목적</dt><dd>{purpose}</dd></div>
                  <div><dt>보관</dt><dd>{period}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <p>
            접속 기록의 IP는 원래 주소로 되돌릴 수 없도록 비밀 키로 바꾼 값만 저장합니다. 같은 사람이 반복해서 입력하는지 가려내는 데만 씁니다.
          </p>
          <p>
            소식 메일에는 열람을 세는 작은 이미지와 링크 클릭을 세는 주소가 들어 있습니다. 메일·날짜별 총 횟수만 저장하며, 누가 열거나 눌렀는지는 저장하지 않습니다.
          </p>
        </section>

        <section aria-labelledby="privacy-share">
          <h2 id="privacy-share">2. 제공</h2>
          <p>
            게스트 신청의 이름과 신청 시각, 대기 명단의 이름·인스타그램 ID와 신청 시각은 신청하신 초대 링크의 아티스트에게 제공됩니다.
          </p>
          <p>
            FAUST(서울)에서 열리는 이벤트는 명단에 오른 게스트의 이름, 인스타그램 ID(적은 경우), 신청 시각과 초대한 아티스트 이름이 입장 확인을 위해 FAUST의 출입 명단에 제공됩니다. 이메일은 제공하지 않으며, FAUST에서의 보관은 FAUST의 출입 기록 기준을 따릅니다.
          </p>
          <p>그 밖의 제3자에게는 제공하지 않습니다.</p>
        </section>

        <section aria-labelledby="privacy-host">
          <h2 id="privacy-host">3. 처리 위탁과 국외 보관</h2>
          <ul className={styles.plain}>
            <li>
              Cloudflare, Inc.(미국): 사이트와 데이터베이스 운영, 입력 화면의 보안 확인(자동 입력 방지). 위 정보는 이 서비스에 저장됩니다.
            </li>
            <li>
              Google LLC(미국, Gmail): 소식 메일 발송. 소식 수신에 동의하신 이메일이 발송에 쓰입니다.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2 id="privacy-rights">4. 열람·정정·삭제 요청</h2>
          <p>
            자신의 정보를 열람하거나 고치거나 지우도록, 또는 처리를 멈추도록 언제든 요청하실 수 있습니다. 소식 메일의 수신 거부 링크를 누르시면 구독과 같은 주소로 남긴 이메일이 바로 지워집니다.
          </p>
        </section>

        <section aria-labelledby="privacy-delete">
          <h2 id="privacy-delete">5. 파기</h2>
          <p>보관 기간이 지난 정보는 지체 없이 지웁니다.</p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2 id="privacy-contact">6. 개인정보 보호책임자와 문의</h2>
          <p>
            개인정보 보호책임자는 TERMINAL 운영자입니다. 문의와 요청은 이메일{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> 또는 인스타그램{' '}
            <a href={PRIVACY_INSTAGRAM.href} target="_blank" rel="noopener noreferrer">
              {PRIVACY_INSTAGRAM.label}
              <span className={ui.srOnly}> (새 탭)</span>
            </a>{' '}
            DM으로 보내 주십시오.
          </p>
        </section>
      </article>
    </div>
  );
}
