import { leaderboard, type BotStyle } from '@arch/engine';
import { useGame } from '../store';
import { fmt } from '../format';

const STYLE: Record<BotStyle, string> = {
  saver: 'Бережливая',
  spender: 'Транжира',
  gambler: 'Рисковый',
};

const AVATAR = ['#3E9A9A', '#E8735A', '#F0A93B', '#7B6CC4'];

export function NeighborsTab() {
  const world = useGame((s) => s.world)!;
  const news = useGame((s) => s.news);
  const rows = leaderboard(world);
  const order = world.players.map((p) => p.id);

  return (
    <div className="tab-body">
      <div className="list-title">Гонка к свободе</div>
      {rows.map((r, i) => {
        const pct = Math.round(r.freedomRatio * 100);
        return (
          <div key={r.playerId} className={`leader ${r.isBot ? '' : 'me'}`}>
            <span className="place">{i + 1}</span>
            <span className="avatar" style={{ background: AVATAR[order.indexOf(r.playerId) % AVATAR.length] }}>
              {r.name.slice(0, 1)}
            </span>
            <div className="leader-main">
              <div className="leader-name">
                {r.isBot ? r.name : 'Вы'} <span className="muted">· {r.islandName}{r.botStyle ? ` · ${STYLE[r.botStyle]}` : ''}</span>
              </div>
              <div className="leader-bar"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
              <div className="leader-sub">
                {r.freedomWeek ? <b className="pos">Свобода с {r.freedomWeek}-й недели</b> : <>{pct}% до свободы</>}
                <span className="muted"> · капитал {fmt(r.netWorth)}</span>
              </div>
            </div>
          </div>
        );
      })}

      <div className="list-title">Новости архипелага</div>
      {news.length === 0
        ? <div className="muted-text">Пока тихо. Новости появятся после первой недели.</div>
        : news.slice(0, 14).map((n, i) => (
            <div key={i} className="news"><span className="muted">Нед. {n.week}</span> {n.text}</div>
          ))}
    </div>
  );
}
