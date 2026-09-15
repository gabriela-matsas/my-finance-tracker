(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FinanceLogic = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function currentYYYYMM(date) {
        const d = date || new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    }

    function monthLabel(yyyymm) {
        const [y, m] = yyyymm.split('-').map(Number);
        return `${MONTH_NAMES[m - 1]} ${y}`;
    }

    function shiftMonth(yyyymm, delta) {
        let [y, m] = yyyymm.split('-').map(Number);
        m += delta;
        while (m < 1) { m += 12; y--; }
        while (m > 12) { m -= 12; y++; }
        return `${y}-${pad(m)}`;
    }

    function formatDate(d) {
        if (!d) return '';
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    }

    function money(n) {
        return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function normalizeTransaction(t, knownCategories, genId) {
        const amount = Number(t.amount) || 0;
        return {
            id: t.id ?? genId(),
            description: t.description || '(sem descrição)',
            amount,
            category: knownCategories.includes(t.category) ? t.category : 'Geral',
            date: t.date || null,
            type: amount < 0 ? 'despesa' : 'receita',
        };
    }

    function filterByMonth(transactions, yyyymm) {
        return transactions.filter(t => t.date && t.date.slice(0, 7) === yyyymm);
    }

    function filterByCategory(transactions, category) {
        if (!category) return transactions.slice();
        return transactions.filter(t => t.category === category);
    }

    function sortByDateDesc(transactions) {
        return transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    function computeTotals(transactions) {
        const income = transactions.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
        const expense = transactions.filter(t => t.amount < 0).reduce((a, t) => a + t.amount, 0);
        return { income, expense: Math.abs(expense), balance: income + expense };
    }

    function computeCategoryTotals(transactions, budgets) {
        const totals = {};
        transactions.filter(t => t.amount < 0).forEach(t => {
            totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
        });
        const safeBudgets = budgets || {};
        const names = new Set([
            ...Object.keys(totals),
            ...Object.keys(safeBudgets).filter(k => safeBudgets[k] > 0),
        ]);
        return [...names]
            .map(name => {
                const spent = totals[name] || 0;
                const budget = safeBudgets[name] || 0;
                const pctOfBudget = budget > 0 ? (spent / budget) * 100 : null;
                let status = 'ok';
                if (budget > 0) {
                    if (spent > budget) status = 'over';
                    else if (spent / budget >= 0.8) status = 'warning';
                }
                return { name, spent, budget, pctOfBudget, status };
            })
            .sort((a, b) => b.spent - a.spent);
    }

    function evaluateCalculatorExpression(expr) {
        if (typeof expr !== 'string' || !/^[0-9+\-*/.\s]+$/.test(expr)) return { ok: false };
        try {
            const result = Function('"use strict"; return (' + expr + ')')();
            if (typeof result !== 'number' || !isFinite(result)) return { ok: false };
            return { ok: true, value: Math.round(result * 100000) / 100000 };
        } catch {
            return { ok: false };
        }
    }

    return {
        MONTH_NAMES,
        pad,
        currentYYYYMM,
        monthLabel,
        shiftMonth,
        formatDate,
        money,
        normalizeTransaction,
        filterByMonth,
        filterByCategory,
        sortByDateDesc,
        computeTotals,
        computeCategoryTotals,
        evaluateCalculatorExpression,
    };
});
