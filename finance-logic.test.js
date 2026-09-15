const test = require('node:test');
const assert = require('node:assert/strict');
const FL = require('./finance-logic.js');

const CATS = ['Geral', 'Alimentação', 'Transporte', 'Salário'];

test('currentYYYYMM formata ano-mês com zero à esquerda', () => {
    assert.equal(FL.currentYYYYMM(new Date(2026, 0, 15)), '2026-01');
    assert.equal(FL.currentYYYYMM(new Date(2026, 10, 1)), '2026-11');
});

test('monthLabel traduz "YYYY-MM" para nome do mês em português', () => {
    assert.equal(FL.monthLabel('2026-09'), 'Setembro 2026');
    assert.equal(FL.monthLabel('2026-01'), 'Janeiro 2026');
});

test('shiftMonth avança e volta dentro do mesmo ano', () => {
    assert.equal(FL.shiftMonth('2026-05', 1), '2026-06');
    assert.equal(FL.shiftMonth('2026-05', -1), '2026-04');
});

test('shiftMonth vira o ano ao passar de dezembro/janeiro', () => {
    assert.equal(FL.shiftMonth('2026-12', 1), '2027-01');
    assert.equal(FL.shiftMonth('2026-01', -1), '2025-12');
});

test('formatDate converte "YYYY-MM-DD" para "DD/MM/YYYY"', () => {
    assert.equal(FL.formatDate('2026-09-15'), '15/09/2026');
    assert.equal(FL.formatDate(null), '');
    assert.equal(FL.formatDate(''), '');
});

test('money formata valores em Real brasileiro', () => {
    assert.equal(FL.money(1234.5), 'R$ 1.234,50');
    assert.equal(FL.money(0), 'R$ 0,00');
});

test('normalizeTransaction preenche campos ausentes com padrões seguros', () => {
    const genId = () => 'gerado-1';
    const result = FL.normalizeTransaction({ amount: '150' }, CATS, genId);
    assert.equal(result.id, 'gerado-1');
    assert.equal(result.description, '(sem descrição)');
    assert.equal(result.amount, 150);
    assert.equal(result.category, 'Geral');
    assert.equal(result.type, 'receita');
});

test('normalizeTransaction rejeita categoria desconhecida e cai para Geral', () => {
    const result = FL.normalizeTransaction({ amount: -50, category: 'CategoriaInventada' }, CATS, () => 'x');
    assert.equal(result.category, 'Geral');
    assert.equal(result.type, 'despesa');
});

test('normalizeTransaction preserva id e categoria existentes', () => {
    const result = FL.normalizeTransaction({ id: 'abc', amount: -20, category: 'Transporte', date: '2026-09-01' }, CATS, () => 'novo');
    assert.equal(result.id, 'abc');
    assert.equal(result.category, 'Transporte');
    assert.equal(result.date, '2026-09-01');
});

test('filterByMonth mantém só as transações do mês pedido', () => {
    const tx = [
        { date: '2026-09-01', amount: 10 },
        { date: '2026-08-15', amount: 20 },
        { date: null, amount: 5 },
    ];
    const result = FL.filterByMonth(tx, '2026-09');
    assert.equal(result.length, 1);
    assert.equal(result[0].date, '2026-09-01');
});

test('filterByCategory sem filtro retorna todas as transações', () => {
    const tx = [{ category: 'Alimentação' }, { category: 'Transporte' }];
    assert.equal(FL.filterByCategory(tx, '').length, 2);
});

test('filterByCategory com filtro retorna só a categoria pedida', () => {
    const tx = [{ category: 'Alimentação' }, { category: 'Transporte' }];
    const result = FL.filterByCategory(tx, 'Transporte');
    assert.equal(result.length, 1);
    assert.equal(result[0].category, 'Transporte');
});

test('sortByDateDesc ordena da transação mais recente para a mais antiga', () => {
    const tx = [{ date: '2026-01-01' }, { date: '2026-09-01' }, { date: '2026-05-01' }];
    const result = FL.sortByDateDesc(tx);
    assert.deepEqual(result.map(t => t.date), ['2026-09-01', '2026-05-01', '2026-01-01']);
});

test('sortByDateDesc não modifica o array original (imutável)', () => {
    const tx = [{ date: '2026-01-01' }, { date: '2026-09-01' }];
    FL.sortByDateDesc(tx);
    assert.equal(tx[0].date, '2026-01-01');
});

test('computeTotals soma receitas e despesas e calcula o saldo', () => {
    const tx = [{ amount: 1000 }, { amount: -300 }, { amount: -50 }];
    const result = FL.computeTotals(tx);
    assert.equal(result.income, 1000);
    assert.equal(result.expense, 350);
    assert.equal(result.balance, 650);
});

test('computeTotals com lista vazia retorna tudo zerado', () => {
    const result = FL.computeTotals([]);
    assert.deepEqual(result, { income: 0, expense: 0, balance: 0 });
});

test('computeCategoryTotals soma despesas por categoria e ordena da maior para a menor', () => {
    const tx = [
        { category: 'Alimentação', amount: -200 },
        { category: 'Alimentação', amount: -100 },
        { category: 'Transporte', amount: -50 },
        { category: 'Salário', amount: 3000 },
    ];
    const result = FL.computeCategoryTotals(tx, {});
    assert.deepEqual(result.map(r => r.name), ['Alimentação', 'Transporte']);
    assert.equal(result[0].spent, 300);
    assert.equal(result[0].status, 'ok');
});

test('computeCategoryTotals marca "warning" a partir de 80% do orçamento', () => {
    const tx = [{ category: 'Alimentação', amount: -400 }];
    const result = FL.computeCategoryTotals(tx, { Alimentação: 500 });
    assert.equal(result[0].status, 'warning');
    assert.equal(result[0].pctOfBudget, 80);
});

test('computeCategoryTotals marca "over" quando o gasto passa do orçamento', () => {
    const tx = [{ category: 'Alimentação', amount: -600 }];
    const result = FL.computeCategoryTotals(tx, { Alimentação: 500 });
    assert.equal(result[0].status, 'over');
});

test('computeCategoryTotals inclui categoria com orçamento definido mesmo sem gasto', () => {
    const result = FL.computeCategoryTotals([], { Lazer: 200 });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Lazer');
    assert.equal(result[0].spent, 0);
});

test('evaluateCalculatorExpression calcula operações válidas', () => {
    assert.deepEqual(FL.evaluateCalculatorExpression('7+3'), { ok: true, value: 10 });
    assert.deepEqual(FL.evaluateCalculatorExpression('10/4'), { ok: true, value: 2.5 });
});

test('evaluateCalculatorExpression rejeita texto que não seja número/operador', () => {
    assert.equal(FL.evaluateCalculatorExpression('alert(1)').ok, false);
    assert.equal(FL.evaluateCalculatorExpression('1;alert(1)').ok, false);
    assert.equal(FL.evaluateCalculatorExpression('window.location').ok, false);
});

test('evaluateCalculatorExpression rejeita divisão por zero (resultado infinito)', () => {
    assert.equal(FL.evaluateCalculatorExpression('5/0').ok, false);
});

test('evaluateCalculatorExpression rejeita expressão vazia ou inválida', () => {
    assert.equal(FL.evaluateCalculatorExpression('').ok, false);
    assert.equal(FL.evaluateCalculatorExpression('5+').ok, false);
});
