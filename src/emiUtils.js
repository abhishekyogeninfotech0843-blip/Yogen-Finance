export function calculateDailyEMI({
  principal,
  totalInterest,
  durationDays,
  startDate,
}) {
  const amount = Number(principal);
  const interest = Number(totalInterest);
  const days = Number(durationDays);

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(interest) ||
    !Number.isInteger(days) ||
    amount <= 0 ||
    interest < 0 ||
    days <= 0 ||
    !startDate
  ) {
    throw new Error("Please enter valid loan details.");
  }

  const totalRepayment = amount + interest;
  const dailyEMI = Math.floor(totalRepayment / days);
  const lastEMI = totalRepayment - dailyEMI * (days - 1);

  const schedule = [];

  // Har calendar day count hoga, Sunday bhi.
  const date = new Date(`${startDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Please enter a valid start date.");
  }

  for (let day = 1; day <= days; day++) {
    const dueDate = new Date(date);
    dueDate.setDate(date.getDate() + day - 1);

    schedule.push({
      installment: day,
      dueDate: [
        dueDate.getFullYear(),
        String(dueDate.getMonth() + 1).padStart(2, "0"),
        String(dueDate.getDate()).padStart(2, "0"),
      ].join("-"),
      amount: day === days ? lastEMI : dailyEMI,
      status: "Pending",
    });
  }

  return {
    principal: amount,
    totalInterest: interest,
    totalRepayment,
    dailyEMI,
    durationDays: days,
    schedule,
  };
}
