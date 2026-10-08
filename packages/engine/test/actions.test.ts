import { describe, expect, it } from 'vitest';
import { saleValue } from '../src/economy';
import { applyAction } from '../src/reducer';
import { LOAN_RATE, REST_COST, REST_JOY } from '../src/rules';
import { financeView, loanLimit, offerViews } from '../src/selectors';
import type { WorldState } from '../src/types';
import { giveAsset, player, putOffer, soloWorld } from './helpers';

function ok(world: WorldState, action: Parameters<typeof applyAction>[1]): WorldState {
  const result = applyAction(world, action);
  expect(result.error).toBeUndefined();
  return result.world;
}

describe('покупка и продажа', () => {
  it('покупка списывает цену, ставит на место и убирает предложение с доски', () => {
    const world = soloWorld();
    const offer = putOffer(world, 'boat', { price: 240, income: 19 });
    const after = ok(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid });
    const p = player(after);
    expect(p.cash).toBe(600 - 240);
    expect(p.owned).toHaveLength(1);
    expect(p.owned[0]).toMatchObject({ defId: 'boat', price: 240, income: 19, slotIndex: 0, damaged: false, boughtWeek: 1 });
    expect(after.offers.find((o) => o.uid === offer.uid)).toBeUndefined();
  });

  it('занимает наименьшее свободное место своего типа', () => {
    const world = soloWorld();
    giveAsset(world, 'p1', 'boat', { slotIndex: 0 });
    giveAsset(world, 'p1', 'boat', { slotIndex: 2 });
    const offer = putOffer(world, 'boat', { price: 100 });
    const after = ok(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid });
    expect(player(after).owned.at(-1)!.slotIndex).toBe(1);
  });

  it('вместимость слота: пятая лодка не влезает на пирс', () => {
    const world = soloWorld();
    for (let i = 0; i < 4; i++) giveAsset(world, 'p1', 'boat');
    const offer = putOffer(world, 'boat', { price: 100 });
    expect(offerViews(world, 'p1').find((v) => v.offer.uid === offer.uid)!.slotFull).toBe(true);
    const result = applyAction(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid });
    expect(result.error).toEqual({ code: 'slotFull', slot: 'pier' });
  });

  it('продажа освобождает место и приносит стоимость продажи', () => {
    const world = soloWorld();
    const asset = giveAsset(world, 'p1', 'cottage', { price: 700 });
    const value = saleValue(asset, world.market);
    expect(value).toBe(Math.round(700 * 0.85));
    const after = ok(world, { type: 'sellAsset', playerId: 'p1', assetUid: asset.uid });
    expect(player(after).cash).toBe(600 + value);
    expect(player(after).owned).toHaveLength(0);
    expect(applyAction(after, { type: 'sellAsset', playerId: 'p1', assetUid: asset.uid }).error).toEqual({ code: 'noSuchAsset' });
  });

  it('не хватает денег — понятная ошибка с суммой', () => {
    const world = soloWorld();
    const offer = putOffer(world, 'cottage', { price: 720 });
    expect(applyAction(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid }).error).toEqual({ code: 'notEnoughCash', missing: 120 });
    player(world).cash = 719;
    expect(applyAction(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid }).error).toEqual({ code: 'notEnoughCash', missing: 1 });
  });
});

describe('знания', () => {
  it('кафе заблокировано без знания 1, после учёбы — доступно', () => {
    let world = soloWorld();
    player(world).cash = 2000;
    const offer = putOffer(world, 'cafe');
    expect(offerViews(world, 'p1').find((v) => v.offer.uid === offer.uid)!.locked).toBe(true);
    expect(applyAction(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid }).error).toEqual({ code: 'needKnowledge', level: 1 });
    world = ok(world, { type: 'study', playerId: 'p1' });
    expect(player(world).knowledge).toBe(1);
    expect(player(world).cash).toBe(1800);
    ok(world, { type: 'buyOffer', playerId: 'p1', offerUid: offer.uid });
  });

  it('учиться можно раз в неделю, цена растёт с уровнем, максимум 3', () => {
    let world = soloWorld();
    player(world).cash = 5000;
    world = ok(world, { type: 'study', playerId: 'p1' });
    expect(applyAction(world, { type: 'study', playerId: 'p1' }).error).toEqual({ code: 'studiedThisWeek' });
    world = ok(world, { type: 'endWeek' });
    const before = player(world).cash;
    world = ok(world, { type: 'study', playerId: 'p1' });
    expect(before - player(world).cash).toBe(400);
    player(world).knowledge = 3;
    player(world).studiedThisWeek = false;
    expect(applyAction(world, { type: 'study', playerId: 'p1' }).error).toEqual({ code: 'maxKnowledge' });
  });

  it('предупреждение об афере видно только со знанием ≥ 1', () => {
    const world = soloWorld();
    const scam = putOffer(world, 'pearlFarm');
    expect(offerViews(world, 'p1').find((v) => v.offer.uid === scam.uid)!.warning).toBeUndefined();
    player(world).knowledge = 1;
    expect(offerViews(world, 'p1').find((v) => v.offer.uid === scam.uid)!.warning).toBe('scam');
  });

  it('окупаемость: ceil(цена / чистый доход), у статуса — null', () => {
    const world = soloWorld();
    const cottage = putOffer(world, 'cottage', { price: 700, income: 40, upkeep: 6 });
    const garden = putOffer(world, 'garden');
    const views = offerViews(world, 'p1');
    expect(views.find((v) => v.offer.uid === cottage.uid)).toMatchObject({ expectedIncome: 40, net: 34, paybackWeeks: 21, weeksLeft: 2 });
    expect(views.find((v) => v.offer.uid === garden.uid)!.paybackWeeks).toBeNull();
  });
});

describe('отдых и подработка', () => {
  it('отдых стоит денег, даёт счастье и доступен раз в неделю', () => {
    let world = soloWorld();
    world = ok(world, { type: 'rest', playerId: 'p1' });
    expect(player(world).cash).toBe(600 - REST_COST);
    expect(player(world).happiness).toBe(70 + REST_JOY);
    expect(applyAction(world, { type: 'rest', playerId: 'p1' }).error).toEqual({ code: 'restedThisWeek' });
    expect(applyAction(world, { type: 'setExtraShift', playerId: 'p1', on: true }).error).toEqual({ code: 'shiftAfterRest' });
  });

  it('подработка: +50% зарплаты и −12 счастья к концу недели, флаг сбрасывается', () => {
    let world = soloWorld();
    world = ok(world, { type: 'setExtraShift', playerId: 'p1', on: true });
    expect(financeView(world, 'p1').salary).toBe(270);
    expect(applyAction(world, { type: 'rest', playerId: 'p1' }).error).toEqual({ code: 'restDuringShift' });
    world = ok(world, { type: 'endWeek' });
    const report = world.lastReport!.players.p1;
    expect(report.salary).toBe(270);
    expect(report.happinessDelta).toBe(-15);
    expect(player(world).extraShift).toBe(false);
  });
});

describe('кредиты', () => {
  it('взять, заплатить проценты деньгами, погасить частями', () => {
    let world = soloWorld();
    const limit = loanLimit(world, 'p1');
    expect(limit).toBeGreaterThan(0);
    expect(limit % 100).toBe(0);
    expect(applyAction(world, { type: 'takeLoan', playerId: 'p1', amount: limit + 100 }).error).toEqual({ code: 'loanOverLimit', limit });
    expect(applyAction(world, { type: 'takeLoan', playerId: 'p1', amount: 0 }).error).toEqual({ code: 'badAmount' });

    world = ok(world, { type: 'takeLoan', playerId: 'p1', amount: 400 });
    expect(player(world).cash).toBe(1000);
    const loan = player(world).loans[0];
    expect(loan).toMatchObject({ principal: 400, weeklyRate: LOAN_RATE, emergency: false });
    expect(loanLimit(world, 'p1')).toBe(limit - 400);

    world = ok(world, { type: 'endWeek' });
    expect(world.lastReport!.players.p1.interest).toBe(Math.round(400 * LOAN_RATE));
    expect(player(world).loans[0].principal).toBe(400);

    world = ok(world, { type: 'repayLoan', playerId: 'p1', loanUid: loan.uid, amount: 150 });
    expect(player(world).loans[0].principal).toBe(250);
    world = ok(world, { type: 'repayLoan', playerId: 'p1', loanUid: loan.uid, amount: 10_000 });
    expect(player(world).loans).toHaveLength(0);
  });

  it('повторный кредит добавляется к уже взятому', () => {
    let world = soloWorld();
    world = ok(world, { type: 'takeLoan', playerId: 'p1', amount: 100 });
    world = ok(world, { type: 'takeLoan', playerId: 'p1', amount: 200 });
    expect(player(world).loans).toHaveLength(1);
    expect(player(world).loans[0].principal).toBe(300);
  });

  it('нельзя погасить больше, чем есть монет', () => {
    let world = soloWorld();
    world = ok(world, { type: 'takeLoan', playerId: 'p1', amount: 500 });
    player(world).cash = 100;
    const loanUid = player(world).loans[0].uid;
    expect(applyAction(world, { type: 'repayLoan', playerId: 'p1', loanUid, amount: 300 }).error).toEqual({ code: 'notEnoughCash', missing: 200 });
  });
});

describe('ремонт', () => {
  it('чинит повреждённый актив за 30% цены', () => {
    let world = soloWorld();
    const boat = giveAsset(world, 'p1', 'boat', { price: 250, damaged: true });
    expect(financeView(world, 'p1').passiveIncome).toBe(0);
    world = ok(world, { type: 'repairAsset', playerId: 'p1', assetUid: boat.uid });
    expect(player(world).cash).toBe(600 - 75);
    expect(player(world).owned[0].damaged).toBe(false);
    expect(applyAction(world, { type: 'repairAsset', playerId: 'p1', assetUid: boat.uid }).error).toEqual({ code: 'notDamaged' });
  });
});
