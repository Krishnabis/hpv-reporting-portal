const targetMonthStr = '2026-09';
const dateObj = new Date(targetMonthStr + '-01');
const nextMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 1);
const monthEndObj = new Date(nextMonth - 1);
const monthEnd = monthEndObj.toISOString().split('T')[0];
console.log(monthEnd);
