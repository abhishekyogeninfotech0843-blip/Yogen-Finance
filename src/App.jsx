import { useEffect, useMemo, useState } from "react";
import "./App.css";

const LOANS_KEY = "yogen_finance_loans";
const TRANSACTIONS_KEY = "yogen_finance_transactions";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function makeSchedule(total, duration, startDate, emi) {
  const count = Math.max(1, Number(duration) || 1);
  const loanTotal = Math.max(0, Number(total) || 0);
  const dailyAmount = Math.max(0, Number(emi) || 0);
  const schedule = [];
  let remaining = loanTotal;

  for (let i = 0; i < count; i++) {
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + i);

    const amount =
      i === count - 1
        ? Math.round(remaining * 100) / 100
        : Math.min(
            Math.round((dailyAmount || loanTotal / count) * 100) / 100,
            remaining,
          );

    remaining = Math.max(0, remaining - amount);

    schedule.push({
      installment: i + 1,
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(date.getDate()).padStart(2, "0")}`,
      amount: Math.round(amount * 100) / 100,
      paidAmount: 0,
      status: "Pending",
    });
  }

  // Make the scheduled installments add up to the exact loan total.
  if (remaining > 0 && schedule.length) {
    schedule[schedule.length - 1].amount += remaining;
  }

  return schedule;
}

function normalizeLoan(loan) {
  const total = Number(loan.total) || 0;
  const paid = Math.min(total, Math.max(0, Number(loan.paid) || 0));

  const schedule =
    Array.isArray(loan.schedule) && loan.schedule.length
      ? loan.schedule.map((item) => ({ ...item }))
      : makeSchedule(total, loan.duration, loan.date || today(), loan.emi);

  // If a schedule has not recorded payments yet, apply the existing
  // paid total from the oldest installment forward.
  const hasRecordedPayments = schedule.some(
    (item) => Number(item.paidAmount) > 0,
  );

  if (!hasRecordedPayments && paid > 0) {
    let leftToAllocate = paid;

    for (const item of schedule) {
      const amount = Number(item.amount) || 0;
      const allocated = Math.min(amount, leftToAllocate);

      item.paidAmount = Math.round(allocated * 100) / 100;
      item.status =
        allocated >= amount - 0.001
          ? "Paid"
          : allocated > 0
            ? "Partial"
            : "Pending";

      leftToAllocate = Math.max(0, leftToAllocate - allocated);
    }
  } else {
    for (const item of schedule) {
      const amount = Number(item.amount) || 0;
      const paidAmount = Math.min(
        amount,
        Math.max(0, Number(item.paidAmount) || 0),
      );

      item.paidAmount = Math.round(paidAmount * 100) / 100;
      item.status =
        paidAmount >= amount - 0.001
          ? "Paid"
          : paidAmount > 0
            ? "Partial"
            : "Pending";
    }
  }

  return {
    ...loan,
    total,
    paid,
    remaining: Math.max(0, Math.round((total - paid) * 100) / 100),
    schedule,
  };
}

const initialLoans = [
  {
    id: "loan-rahul",
    name: "Rahul Sharma",
    phone: "9876543210",
    principal: 10000,
    interest: 2000,
    total: 12000,
    paid: 3000,
    emi: 100,
    duration: 120,
    date: today(),
    schedule: [],
  },
  {
    id: "loan-amit",
    name: "Amit Kumar",
    phone: "9876501234",
    principal: 20000,
    interest: 4000,
    total: 24000,
    paid: 8000,
    emi: 200,
    duration: 120,
    date: today(),
    schedule: [],
  },
];

function StatusBadge({ status }) {
  const className =
    status === "Paid"
      ? "status-badge paid"
      : status === "Partial"
        ? "status-badge partial"
        : status === "Overdue"
          ? "status-badge overdue"
          : "status-badge pending";

  return <span className={className}>{status}</span>;
}

function StatCard({ title, value, subtitle, icon, className = "" }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-top">
        <span className="stat-title">{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}

function LoanTable({ loans, onDetails, onCollect }) {
  if (!loans.length) {
    return <div className="empty-state">No borrowers found.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Borrower</th>
            <th>Loan Amount</th>
            <th>Total Payable</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => {
            const fullyPaid = loan.remaining <= 0;

            return (
              <tr key={loan.id}>
                <td>
                  <div className="borrower-cell">
                    <div className="borrower-avatar">
                      {loan.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{loan.name}</strong>
                      <small>{loan.phone || "No phone number"}</small>
                    </div>
                  </div>
                </td>
                <td>{money(loan.principal)}</td>
                <td>{money(loan.total)}</td>
                <td className="amount-paid">{money(loan.paid)}</td>
                <td className="amount-remaining">{money(loan.remaining)}</td>
                <td>
                  <StatusBadge status={fullyPaid ? "Paid" : "Pending"} />
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn-small btn-outline"
                      onClick={() => onDetails(loan)}
                    >
                      Details
                    </button>
                    {!fullyPaid && (
                      <button
                        className="btn-small btn-primary"
                        onClick={() => onCollect(loan)}
                      >
                        Collect
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoanDetails({ loan, onClose, onCollect }) {
  if (!loan) return null;

  const completed = loan.schedule.filter(
    (item) => item.status === "Paid",
  ).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content loan-details-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{loan.name}</h2>
            <p>Loan details and daily repayment schedule</p>
          </div>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="details-grid">
          <div className="detail-card">
            <span>Principal</span>
            <strong>{money(loan.principal)}</strong>
          </div>
          <div className="detail-card">
            <span>Interest</span>
            <strong>{money(loan.interest)}</strong>
          </div>
          <div className="detail-card">
            <span>Total paid</span>
            <strong>{money(loan.paid)}</strong>
          </div>
          <div className="detail-card">
            <span>Remaining</span>
            <strong>{money(loan.remaining)}</strong>
          </div>
        </div>

        <div className="schedule-heading">
          <div>
            <h3>Repayment Schedule</h3>
            <p>
              {completed} of {loan.schedule.length} installments fully paid
            </p>
          </div>
          {loan.remaining > 0 && (
            <button className="btn-primary" onClick={() => onCollect(loan)}>
              Collect Payment
            </button>
          )}
        </div>

        <div className="table-wrap schedule-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Installment</th>
                <th>Due Date</th>
                <th>Amount Due</th>
                <th>Amount Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loan.schedule.map((item) => (
                <tr key={item.installment}>
                  <td>#{item.installment}</td>
                  <td>{item.date}</td>
                  <td>{money(item.amount)}</td>
                  <td>{money(item.paidAmount)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function App({ session, onLogout, onCustomerView }) {
  const [loans, setLoans] = useState(() =>
    readStorage(LOANS_KEY, initialLoans).map(normalizeLoan),
  );

  const [transactions, setTransactions] = useState(() =>
    readStorage(TRANSACTIONS_KEY, []),
  );

  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedLoan, setSelectedLoan] = useState(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    principal: "",
    interest: "",
    duration: "120",
    date: today(),
  });

  useEffect(() => {
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const totalDisbursed = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.principal, 0),
    [loans],
  );

  const totalPayable = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.total, 0),
    [loans],
  );

  const totalCollected = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.paid, 0),
    [loans],
  );

  const totalRemaining = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.remaining, 0),
    [loans],
  );

  const activeLoans = loans.filter((loan) => loan.remaining > 0);
  const completedLoans = loans.filter((loan) => loan.remaining <= 0);

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return loans;

    return loans.filter(
      (loan) =>
        loan.name.toLowerCase().includes(term) ||
        String(loan.phone || "").includes(term),
    );
  }, [loans, search]);

  const dueToday = useMemo(() => {
    return loans.reduce((sum, loan) => {
      const todayItems = loan.schedule.filter(
        (item) => item.date === today() && item.status !== "Paid",
      );

      return (
        sum +
        todayItems.reduce(
          (itemSum, item) =>
            itemSum +
            Math.max(
              0,
              (Number(item.amount) || 0) - (Number(item.paidAmount) || 0),
            ),
          0,
        )
      );
    }, 0);
  }, [loans]);

  const previewPrincipal = Number(form.principal) || 0;
  const previewInterest = Number(form.interest) || 0;
  const previewTotal = previewPrincipal + previewInterest;
  const previewDuration = Math.max(1, Number(form.duration) || 1);
  const previewEmi = Math.round((previewTotal / previewDuration) * 100) / 100;

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((old) => ({ ...old, [name]: value }));
  }

  function addLoan(event) {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const principal = Number(form.principal);
    const interest = Number(form.interest);
    const duration = Number(form.duration);
    const date = form.date || today();

    if (!name) {
      setNotice("Please enter the borrower's name.");
      return;
    }

    if (!Number.isFinite(principal) || principal <= 0) {
      setNotice("Please enter a valid loan amount.");
      return;
    }

    if (!Number.isFinite(interest) || interest < 0) {
      setNotice("Interest cannot be negative.");
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
      setNotice("Enter a duration between 1 and 3650 days.");
      return;
    }

    const total = Math.round((principal + interest) * 100) / 100;
    const emi = Math.round((total / duration) * 100) / 100;

    const loan = normalizeLoan({
      id: `loan-${Date.now()}`,
      name,
      phone,
      principal,
      interest,
      total,
      paid: 0,
      emi,
      duration,
      date,
      schedule: makeSchedule(total, duration, date, emi),
    });

    setLoans((old) => [loan, ...old]);

    setTransactions((old) => [
      {
        id: `transaction-${Date.now()}`,
        loanId: loan.id,
        name: loan.name,
        type: "Loan Disbursed",
        amount: principal,
        date: new Date().toLocaleString("en-IN"),
        installment: null,
      },
      ...old,
    ]);

    setForm({
      name: "",
      phone: "",
      principal: "",
      interest: "",
      duration: "120",
      date: today(),
    });

    setPage("Borrowers List");
    setNotice(`Loan created successfully for ${name}.`);
  }

  function collectPayment(loan) {
    const currentLoan = loans.find((item) => item.id === loan.id);
    if (!currentLoan) return;

    const remaining = Math.max(0, currentLoan.total - currentLoan.paid);

    if (remaining <= 0) {
      setNotice("This loan is already fully paid.");
      return;
    }

    const schedule = currentLoan.schedule;
    const installment = schedule.find(
      (item) =>
        item.status !== "Paid" &&
        Number(item.paidAmount || 0) < Number(item.amount || 0),
    );

    if (!installment) {
      setNotice("No pending installment found for this loan.");
      return;
    }

    const installmentRemaining = Math.max(
      0,
      Number(installment.amount) - Number(installment.paidAmount || 0),
    );

    const defaultAmount = Math.min(installmentRemaining, remaining);
    const input = window.prompt(
      `Borrower: ${currentLoan.name}\nInstallment: #${installment.installment}\nInstallment balance: ${money(installmentRemaining)}\nTotal loan balance: ${money(remaining)}\n\nEnter the amount collected:`,
      String(defaultAmount),
    );

    if (input === null) return;

    const amount = Number(input);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > installmentRemaining + 0.001 ||
      amount > remaining + 0.001
    ) {
      setNotice(
        `Enter an amount greater than ₹0 and no more than ${money(
          Math.min(installmentRemaining, remaining),
        )}.`,
      );
      return;
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    if (
      !window.confirm(
        `Confirm collection of ${money(roundedAmount)} from ${currentLoan.name}?`,
      )
    ) {
      return;
    }

    const updatedSchedule = schedule.map((item) => {
      if (item.installment !== installment.installment) return item;

      const paidAmount =
        Math.round((Number(item.paidAmount || 0) + roundedAmount) * 100) / 100;

      return {
        ...item,
        paidAmount,
        status: paidAmount >= Number(item.amount) - 0.001 ? "Paid" : "Partial",
      };
    });

    const updatedPaid =
      Math.round((currentLoan.paid + roundedAmount) * 100) / 100;

    setLoans((old) =>
      old.map((item) =>
        item.id === currentLoan.id
          ? normalizeLoan({
              ...item,
              paid: Math.min(item.total, updatedPaid),
              schedule: updatedSchedule,
            })
          : item,
      ),
    );

    setTransactions((old) => [
      {
        id: `transaction-${Date.now()}`,
        loanId: currentLoan.id,
        name: currentLoan.name,
        type: "EMI Payment",
        amount: roundedAmount,
        date: new Date().toLocaleString("en-IN"),
        installment: installment.installment,
      },
      ...old,
    ]);

    setSelectedLoan((old) =>
      old?.id === currentLoan.id
        ? normalizeLoan({
            ...currentLoan,
            paid: Math.min(currentLoan.total, updatedPaid),
            schedule: updatedSchedule,
          })
        : old,
    );

    setNotice(
      `${money(roundedAmount)} payment recorded for ${currentLoan.name}.`,
    );
  }

  const menuItems = [
    { name: "Dashboard", icon: "▦" },
    { name: "Daily Collection Sheet", icon: "▤" },
    { name: "Borrowers List", icon: "♙" },
    { name: "Issue New Loan", icon: "+" },
    { name: "All Transactions Log", icon: "↔" },
  ];

  function renderContent() {
    if (page === "Issue New Loan") {
      return (
        <div className="content-card loan-form-card">
          <div className="section-heading">
            <div>
              <h2>Issue New Loan</h2>
              <p>Add borrower information and configure repayment.</p>
            </div>
          </div>

          <form className="loan-form" onSubmit={addLoan}>
            <div className="form-grid">
              <label className="form-field">
                <span>Borrower Name *</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  placeholder="Enter full name"
                  required
                />
              </label>

              <label className="form-field">
                <span>Phone Number</span>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={updateForm}
                  placeholder="Enter phone number"
                  inputMode="numeric"
                />
              </label>

              <label className="form-field">
                <span>Principal Amount (₹) *</span>
                <input
                  name="principal"
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.principal}
                  onChange={updateForm}
                  placeholder="e.g. 10000"
                  required
                />
              </label>

              <label className="form-field">
                <span>Total Interest (₹) *</span>
                <input
                  name="interest"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.interest}
                  onChange={updateForm}
                  placeholder="e.g. 2000"
                  required
                />
              </label>

              <label className="form-field">
                <span>Duration (calendar days) *</span>
                <input
                  name="duration"
                  type="number"
                  min="1"
                  max="3650"
                  step="1"
                  value={form.duration}
                  onChange={updateForm}
                  required
                />
              </label>

              <label className="form-field">
                <span>Loan Start Date *</span>
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={updateForm}
                  required
                />
              </label>
            </div>

            <div className="loan-preview">
              <h3>Repayment Summary</h3>
              <div className="preview-grid">
                <div>
                  <span>Principal</span>
                  <strong>{money(previewPrincipal)}</strong>
                </div>
                <div>
                  <span>Interest</span>
                  <strong>{money(previewInterest)}</strong>
                </div>
                <div>
                  <span>Total Payable</span>
                  <strong>{money(previewTotal)}</strong>
                </div>
                <div>
                  <span>Approx. Daily EMI</span>
                  <strong>{money(previewEmi)}</strong>
                </div>
              </div>
              <p>
                Installments are scheduled on consecutive calendar days,
                including Sundays. The final installment is adjusted for
                rounding.
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  setForm({
                    name: "",
                    phone: "",
                    principal: "",
                    interest: "",
                    duration: "120",
                    date: today(),
                  })
                }
              >
                Clear Form
              </button>
              <button type="submit" className="btn-primary">
                Create Loan
              </button>
            </div>
          </form>
        </div>
      );
    }

    if (page === "Borrowers List") {
      return (
        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>Borrowers List</h2>
              <p>View loans, payment progress and outstanding balances.</p>
            </div>
            <button
              className="btn-primary"
              onClick={() => setPage("Issue New Loan")}
            >
              + Issue New Loan
            </button>
          </div>

          <div className="search-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search borrower name or phone..."
            />
          </div>

          <LoanTable
            loans={filteredLoans}
            onDetails={setSelectedLoan}
            onCollect={collectPayment}
          />
        </div>
      );
    }

    if (page === "Daily Collection Sheet") {
      const todayItems = loans.flatMap((loan) =>
        loan.schedule
          .filter((item) => item.date === today() && item.status !== "Paid")
          .map((item) => ({
            loan,
            installment: item,
            due: Math.max(
              0,
              Number(item.amount) - Number(item.paidAmount || 0),
            ),
          })),
      );

      return (
        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>Daily Collection Sheet</h2>
              <p>Scheduled installments due today: {today()}</p>
            </div>
            <div className="collection-total">
              <span>Total Due Today</span>
              <strong>{money(dueToday)}</strong>
            </div>
          </div>

          {!todayItems.length ? (
            <div className="empty-state">
              No unpaid installments are scheduled for today.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Installment</th>
                    <th>Due Amount</th>
                    <th>Already Paid</th>
                    <th>Due Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todayItems.map(({ loan, installment, due }) => (
                    <tr key={`${loan.id}-${installment.installment}`}>
                      <td>{loan.name}</td>
                      <td>#{installment.installment}</td>
                      <td>{money(due)}</td>
                      <td>{money(installment.paidAmount)}</td>
                      <td>{installment.date}</td>
                      <td>
                        <button
                          className="btn-small btn-primary"
                          onClick={() => collectPayment(loan)}
                        >
                          Collect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (page === "All Transactions Log") {
      return (
        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>All Transactions Log</h2>
              <p>Record of loans issued and payments collected.</p>
            </div>
          </div>

          {!transactions.length ? (
            <div className="empty-state">No transactions recorded yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th>Transaction Type</th>
                    <th>Amount</th>
                    <th>Installment</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.name}</td>
                      <td>
                        <span
                          className={
                            transaction.type === "Loan Disbursed"
                              ? "transaction-type disbursed"
                              : "transaction-type payment"
                          }
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td>{money(transaction.amount)}</td>
                      <td>
                        {transaction.installment
                          ? `#${transaction.installment}`
                          : "—"}
                      </td>
                      <td>{transaction.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="stats-grid">
          <StatCard
            title="Total Disbursed"
            value={money(totalDisbursed)}
            subtitle="Principal amount issued"
            icon="₹"
            className="stat-blue"
          />
          <StatCard
            title="Total Payable"
            value={money(totalPayable)}
            subtitle="Principal + interest"
            icon="▤"
            className="stat-purple"
          />
          <StatCard
            title="Total Collected"
            value={money(totalCollected)}
            subtitle="Payments recorded"
            icon="↗"
            className="stat-green"
          />
          <StatCard
            title="Outstanding Balance"
            value={money(totalRemaining)}
            subtitle="Amount yet to collect"
            icon="◷"
            className="stat-orange"
          />
        </div>

        <div className="dashboard-grid">
          <div className="content-card overview-card">
            <div className="section-heading">
              <div>
                <h2>Collection Overview</h2>
                <p>Payment progress across all borrowers</p>
              </div>
            </div>

            <div className="collection-overview">
              <div
                className="donut-chart"
                style={{
                  "--collection-percent": `${
                    totalPayable > 0
                      ? Math.min(100, (totalCollected / totalPayable) * 100)
                      : 0
                  }%`,
                }}
              >
                <div className="donut-center">
                  <strong>
                    {totalPayable > 0
                      ? `${Math.round((totalCollected / totalPayable) * 100)}%`
                      : "0%"}
                  </strong>
                  <span>Collected</span>
                </div>
              </div>

              <div className="overview-legend">
                <div>
                  <span className="legend-dot collected-dot" />
                  <span>Collected</span>
                  <strong>{money(totalCollected)}</strong>
                </div>
                <div>
                  <span className="legend-dot remaining-dot" />
                  <span>Remaining</span>
                  <strong>{money(totalRemaining)}</strong>
                </div>
                <div>
                  <span className="legend-dot principal-dot" />
                  <span>Active Loans</span>
                  <strong>{activeLoans.length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="content-card collection-summary-card">
            <div className="section-heading">
              <div>
                <h2>Today's Collection</h2>
                <p>{today()}</p>
              </div>
              <span className="summary-icon">₹</span>
            </div>

            <div className="today-amount">{money(dueToday)}</div>
            <p className="muted-text">
              Unpaid scheduled installments due today
            </p>

            <div className="summary-row">
              <span>Active borrowers</span>
              <strong>{activeLoans.length}</strong>
            </div>
            <div className="summary-row">
              <span>Completed loans</span>
              <strong>{completedLoans.length}</strong>
            </div>

            <button
              className="btn-primary full-width"
              onClick={() => setPage("Daily Collection Sheet")}
            >
              Open Collection Sheet
            </button>
          </div>
        </div>

        <div className="content-card recent-borrowers-card">
          <div className="section-heading">
            <div>
              <h2>Borrowers Overview</h2>
              <p>Recent loan accounts and outstanding balances</p>
            </div>
            <button
              className="btn-outline"
              onClick={() => setPage("Borrowers List")}
            >
              View All
            </button>
          </div>

          <LoanTable
            loans={loans.slice(0, 5)}
            onDetails={setSelectedLoan}
            onCollect={collectPayment}
          />
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">Y</div>
          <div className="brand-copy">
            <strong>YOGEN</strong>
            <span>FINANCE</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => setPage(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {item.name === "Daily Collection Sheet" && dueToday > 0 && (
                <span className="nav-count">!</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-avatar">
            {(session?.name || "Admin")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="admin-info">
            <strong>{session?.name || "Administrator"}</strong>
            <span>Administrator</span>
          </div>
          <div className="sidebar-actions">
            <button className="role-switch" onClick={onCustomerView}>
              <span aria-hidden="true">♙</span>
              Customer View
            </button>
            <button className="logout-button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="page-title">
            <h1>{page}</h1>
            <p>Welcome back! Here's your finance overview.</p>
          </div>

          <div className="topbar-actions">
            <div className="today-chip">
              <span>◷</span>
              {today()}
            </div>
            <button
              className="btn-primary"
              onClick={() => setPage("Issue New Loan")}
            >
              + Issue New Loan
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">
              ×
            </button>
          </div>
        )}

        <section className="page-content">{renderContent()}</section>

        <footer className="app-footer">
          <span>Yogen Finance</span>
          <span>Finance management dashboard</span>
        </footer>
      </main>

      {selectedLoan && (
        <LoanDetails
          loan={
            loans.find((item) => item.id === selectedLoan.id) || selectedLoan
          }
          onClose={() => setSelectedLoan(null)}
          onCollect={collectPayment}
        />
      )}
    </div>
  );
}
