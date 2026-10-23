import { useState } from "react";
import App from "./App";
import "./AuthGate.css";

const SESSION_KEY = "yogen_finance_demo_session";

// Demo accounts only. Real authentication will be added with the backend.
const DEMO_USERS = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Yogen Finance Admin",
  },
  {
    username: "rahul",
    password: "user123",
    role: "user",
    name: "Rahul Sharma",
  },
  {
    username: "amit",
    password: "user123",
    role: "user",
    name: "Amit Kumar",
  },
];

function readSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function readStoredRecords(key) {
  try {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const matchedUser = DEMO_USERS.find(
      (user) =>
        user.username === username.trim().toLowerCase() &&
        user.password === password,
    );

    if (!matchedUser) {
      setError("Username ya password sahi nahi hai.");
      return;
    }

    const session = {
      username: matchedUser.username,
      role: matchedUser.role,
      name: matchedUser.name,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    onLogin(session);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo">Y</div>
        <p className="auth-eyebrow">YOGEN INFOTECH</p>
        <h1>Yogen Finance</h1>
        <p className="auth-subtitle">
          Sign in to manage loans and daily collections.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            required
          />

          <label htmlFor="password">Password</label>
          <div className="auth-password-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
            <button
              type="button"
              className="auth-show-password"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit">
            Sign In
          </button>
        </form>

        <div className="auth-demo">
          <h2>Demo login details</h2>
          <p>
            <strong>Admin:</strong> admin / admin123
          </p>
          <p>
            <strong>Rahul (User):</strong> rahul / user123
          </p>
          <p>
            <strong>Amit (User):</strong> amit / user123
          </p>
          <p className="auth-warning">
            Demo only — do not use real customer passwords or financial data.
          </p>
        </div>
      </section>
    </main>
  );
}

function UserDashboard({
  session,
  onLogout,
  isAdminPreview = false,
  onAdminReturn,
  selectedUsername,
  onSelectUser,
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const loans = readStoredRecords("yogen_finance_loans");
  const transactions = readStoredRecords("yogen_finance_transactions");

  // Match this demo account to the corresponding borrower name.
  const borrowerName =
    DEMO_USERS.find(
      (user) => user.role === "user" && user.username === session.username,
    )?.name || session.name;

  const myLoans = loans.filter((loan) => {
    const name =
      loan.borrowerName ||
      loan.borrower ||
      loan.customerName ||
      loan.name ||
      "";
    return String(name).trim().toLowerCase() === borrowerName.toLowerCase();
  });

  const myLoanIds = myLoans.map((loan) => String(loan.id ?? loan._id ?? ""));
  const myTransactions = transactions.filter((transaction) => {
    const transactionName =
      transaction.borrowerName ||
      transaction.borrower ||
      transaction.customerName ||
      transaction.name ||
      "";
    const transactionLoanId = String(
      transaction.loanId ?? transaction.loan?._id ?? transaction.loan?.id ?? "",
    );

    return (
      String(transactionName).trim().toLowerCase() ===
        borrowerName.toLowerCase() ||
      (transactionLoanId !== "" && myLoanIds.includes(transactionLoanId))
    );
  });

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function getTotal(loan) {
    return Number(
      loan.totalPayable ??
        loan.totalAmount ??
        loan.totalRepayable ??
        loan.amountWithInterest ??
        loan.total ??
        loan.principal ??
        loan.loanAmount ??
        0,
    );
  }

  function getPaid(loan) {
    return Number(loan.paidAmount ?? loan.totalPaid ?? loan.paid ?? 0);
  }

  const totalLoan = myLoans.reduce((sum, loan) => sum + getTotal(loan), 0);
  const totalPaid = myLoans.reduce((sum, loan) => sum + getPaid(loan), 0);
  const remaining = myLoans.reduce(
    (sum, loan) => sum + Math.max(0, getTotal(loan) - getPaid(loan)),
    0,
  );

  return (
    <main className="user-page">
      <header className="user-topbar">
        <div>
          <p className="user-brand">YOGEN FINANCE</p>
          <h1>Welcome, {borrowerName}</h1>
          <p className="user-muted">Your personal loan dashboard</p>
        </div>
        <div className="user-topbar-actions">
          {isAdminPreview && (
            <>
              <label className="customer-select-label" htmlFor="customer-preview">
                Preview customer
              </label>
              <select
                id="customer-preview"
                className="customer-select"
                value={selectedUsername}
                onChange={(event) => onSelectUser(event.target.value)}
              >
                {DEMO_USERS.filter((user) => user.role === "user").map(
                  (user) => (
                    <option key={user.username} value={user.username}>
                      {user.name}
                    </option>
                  ),
                )}
              </select>
              <button className="user-return" onClick={onAdminReturn}>
                Admin (Lender)
              </button>
            </>
          )}
          <button className="user-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="user-notice">
        <strong>My Account</strong>
        <span>
          Yahan sirf is demo account se match hone wale loans dikhaye jaate
          hain.
        </span>
      </section>

      <section className="user-stat-grid">
        <article className="user-stat">
          <span>Total loan amount</span>
          <strong>{money(totalLoan)}</strong>
        </article>
        <article className="user-stat">
          <span>Total paid</span>
          <strong>{money(totalPaid)}</strong>
        </article>
        <article className="user-stat">
          <span>Remaining balance</span>
          <strong>{money(remaining)}</strong>
        </article>
      </section>

      <section className="user-panel">
        <div className="user-panel-heading">
          <div>
            <h2>My Loans</h2>
            <p>Loan amount, daily EMI and repayment progress</p>
          </div>
          <button
            className="user-refresh"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Refresh
          </button>
        </div>

        {myLoans.length === 0 ? (
          <p className="user-empty">
            Is demo user ke naam par koi loan nahi mila. Admin dashboard mein
            borrower ka naam {borrowerName} hona chahiye.
          </p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table" key={refreshKey}>
              <thead>
                <tr>
                  <th>Loan / Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Daily EMI</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {myLoans.map((loan, index) => {
                  const total = getTotal(loan);
                  const paid = getPaid(loan);
                  const balance = Math.max(0, total - paid);
                  const progress =
                    total > 0
                      ? Math.min(100, Math.round((paid / total) * 100))
                      : 0;

                  return (
                    <tr key={loan.id ?? loan._id ?? index}>
                      <td>
                        <strong>Loan {index + 1}</strong>
                        <small>
                          {loan.startDate || loan.date || loan.createdAt
                            ? new Date(
                                loan.startDate || loan.date || loan.createdAt,
                              ).toLocaleDateString("en-IN")
                            : "Date not available"}
                        </small>
                      </td>
                      <td>{money(total)}</td>
                      <td>{money(paid)}</td>
                      <td>{money(balance)}</td>
                      <td>
                        {money(loan.dailyEmi ?? loan.dailyEMI ?? loan.emi ?? 0)}
                      </td>
                      <td>
                        <div className="user-progress">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <small>{progress}% paid</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="user-panel">
        <div className="user-panel-heading">
          <div>
            <h2>Payment History</h2>
            <p>Your recorded payments</p>
          </div>
        </div>

        {myTransactions.length === 0 ? (
          <p className="user-empty">Abhi koi payment record nahi mila.</p>
        ) : (
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {myTransactions.map((transaction, index) => (
                  <tr key={transaction.id ?? transaction._id ?? index}>
                    <td>
                      {transaction.date || transaction.createdAt
                        ? new Date(
                            transaction.date || transaction.createdAt,
                          ).toLocaleDateString("en-IN")
                        : "Date not available"}
                    </td>
                    <td>
                      {money(
                        transaction.amount ??
                          transaction.paymentAmount ??
                          transaction.paidAmount ??
                          0,
                      )}
                    </td>
                    <td>
                      {transaction.note ||
                        transaction.method ||
                        transaction.status ||
                        "Payment recorded"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="user-footer">
        Yogen Finance · Demo user panel · Online payments are not enabled yet.
      </p>
    </main>
  );
}

export default function AuthGate() {
  const [session, setSession] = useState(readSession);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState("rahul");

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setIsAdminPreview(false);
  }

  if (!session || !["admin", "user"].includes(session.role)) {
    return <LoginScreen onLogin={setSession} />;
  }

  if (session.role === "admin") {
    if (isAdminPreview) {
      const previewUser = DEMO_USERS.find(
        (user) => user.username === selectedUsername && user.role === "user",
      );

      return (
        <UserDashboard
          session={
            previewUser || DEMO_USERS.find((user) => user.username === "rahul")
          }
          onLogout={handleLogout}
          isAdminPreview
          onAdminReturn={() => setIsAdminPreview(false)}
          selectedUsername={previewUser?.username || "rahul"}
          onSelectUser={setSelectedUsername}
        />
      );
    }

    return (
      <App
        session={session}
        onLogout={handleLogout}
        onCustomerView={() => setIsAdminPreview(true)}
      />
    );
  }

  return <UserDashboard session={session} onLogout={handleLogout} />;
}
