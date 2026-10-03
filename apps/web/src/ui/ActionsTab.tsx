import {
  financeView, getPlayer, insurancePremium, loanLimit, studyCost,
  EMERGENCY_RATE, LOAN_RATE, REST_COST, REST_JOY,
} from '@arch/engine';
import { HUMAN, useGame } from '../store';
import { fmt } from '../format';
import { Pips, Section } from './common';

const KNOWLEDGE_UNLOCKS = [
  'Будете замечать аферы и сможете открыть пляжное кафе',
  'Откроются доли в рыболовецкой артели',
  '+10% к доходу всех активов',
];

const pct = (rate: number) => `${(rate * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;

export function ActionsTab() {
  const world = useGame((s) => s.world)!;
  const act = useGame((s) => s.act);
  const me = getPlayer(world, HUMAN);
  const fin = financeView(world, HUMAN);
  const limit = loanLimit(world, HUMAN);
  const premium = insurancePremium(me);
  const cost = studyCost(me);
  const shiftBonus = Math.round(me.salary * 0.5);

  return (
    <div className="tab-body">
      <Section title="Работа и отдых">
        {me.happiness < 30 && (
          <div className="warning">
            Счастье на исходе. Ниже 20 начинается выгорание — зарплата падает вдвое. Пора отдохнуть.
          </div>
        )}
        <label className={`toggle-row ${me.restedThisWeek ? 'off' : ''}`}>
          <div>
            <b>Подработка на этой неделе</b>
            <span>
              {me.restedThisWeek ? 'На этой неделе вы отдыхаете' : `+${fmt(shiftBonus)} монет, но −12 счастья`}
            </span>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={me.extraShift}
            disabled={me.restedThisWeek}
            onChange={(e) => act({ type: 'setExtraShift', playerId: HUMAN, on: e.target.checked })}
          />
        </label>
        <div className="action-row">
          <div>
            <b>Отдохнуть с семьёй</b>
            <span>
              {me.extraShift ? 'В неделю подработки отдохнуть не выйдет' : `${fmt(REST_COST)} монет, +${REST_JOY} счастья. Раз в неделю`}
            </span>
          </div>
          <button
            className="btn ghost sm"
            disabled={me.restedThisWeek || me.extraShift}
            onClick={() => act({ type: 'rest', playerId: HUMAN }, 'Хорошо отдохнули!')}
          >
            {me.restedThisWeek ? 'Уже отдыхали' : 'Отдохнуть'}
          </button>
        </div>
      </Section>

      <Section title="Учёба" aside={<Pips value={me.knowledge} max={3} />}>
        {cost !== null ? (
          <div className="action-row">
            <div>
              <b>Курс финансовой грамотности</b>
              <span>{KNOWLEDGE_UNLOCKS[me.knowledge]}</span>
            </div>
            <button
              className="btn primary sm"
              disabled={me.studiedThisWeek}
              onClick={() => act({ type: 'study', playerId: HUMAN }, 'Знания растут!')}
            >
              {me.studiedThisWeek ? 'На след. неделе' : `Учиться ${fmt(cost)}`}
            </button>
          </div>
        ) : (
          <div className="muted-text">Вы прошли все курсы. Активы приносят на 10% больше.</div>
        )}
      </Section>

      <Section title="Страховка">
        <label className="toggle-row">
          <div>
            <b>Страховать имущество и здоровье</b>
            <span>−{fmt(premium)} в неделю. Оплатит ремонт после шторма и лечение</span>
          </div>
          <input
            type="checkbox"
            className="switch"
            checked={me.insured}
            onChange={(e) => act({ type: 'setInsurance', playerId: HUMAN, on: e.target.checked })}
          />
        </label>
      </Section>

      <Section title="Банк архипелага">
        <div className="muted-text">
          Кредит помогает купить актив раньше, но каждую неделю нужно платить {pct(LOAN_RATE)} от долга.
          Если наличные уйдут в минус, придётся занять у ростовщика под {pct(EMERGENCY_RATE)} в неделю.
        </div>
        <div className="loan-take">
          <span>Можно занять: <b>{fmt(limit)}</b></span>
          <div className="btn-group">
            {[100, 500].map((amount) => (
              <button
                key={amount}
                className="btn ghost sm"
                disabled={limit < amount}
                onClick={() => act({ type: 'takeLoan', playerId: HUMAN, amount }, `Взяли в кредит ${fmt(amount)}`)}
              >
                +{fmt(amount)}
              </button>
            ))}
          </div>
        </div>
        {me.loans.map((loan) => {
          const pay = Math.min(me.cash, loan.principal);
          return (
            <div key={loan.uid} className={`action-row loan ${loan.emergency ? 'emergency' : ''}`}>
              <div>
                <b>{loan.emergency ? 'Заём у ростовщика' : 'Кредит банка'}: {fmt(loan.principal)}</b>
                <span>{pct(loan.weeklyRate)} в неделю = −{fmt(loan.principal * loan.weeklyRate)}</span>
              </div>
              <button
                className="btn ghost sm"
                disabled={pay <= 0}
                onClick={() => act({ type: 'repayLoan', playerId: HUMAN, loanUid: loan.uid, amount: pay }, 'Долг уменьшился')}
              >
                Погасить {fmt(pay)}
              </button>
            </div>
          );
        })}
        {fin.debt === 0 && <div className="muted-text">Долгов нет.</div>}
      </Section>
    </div>
  );
}
