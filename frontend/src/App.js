import "./App.css";
import { Route, Routes, Navigate } from "react-router-dom";
import Admin from "./Components/admin/Admin";
import User from "./Components/counter/counter";
import Counters from "./Components/admin/pages/Counters";
import Queue from "./Components/admin/pages/Queue";
import Services from "./Components/admin/pages/Services";
import Buttons from "./Components/admin/pages/Buttons";
import BankOpening from "./Components/admin/pages/BankOpening";
import AutoCall from "./Components/admin/pages/AutoCall";
import Password from "./Components/admin/pages/Password";
import Login from "./Components/login/login";
import RequireAuth from "./Components/auth/RequireAuth";
import Customer from "./Components/customer/Customer";
import CustomerServices from "./Components/customer/CustomerServices";
import CustomerServiceOrder from "./Components/customer/CustomerServiceOrder";
import CustomerDate from "./Components/customer/CustomerDate";
import CustomerConfirm from "./Components/customer/CustomerConfirm";
import CustomerTokens from "./Components/customer/CustomerTokens";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireAuth requireRole="admin">
              <Admin />
            </RequireAuth>
          }
        >
          <Route index element={<Counters />} />
          <Route path="counters" element={<Counters />} />
          <Route path="queue" element={<Queue />} />
          <Route path="services" element={<Services />} />
          <Route path="bank-opening" element={<BankOpening />} />
          <Route path="buttons" element={<Buttons />} />
          <Route path="autocall" element={<AutoCall />} />
          <Route path="password" element={<Password />} />
        </Route>
        <Route path="/customer" element={<Customer />} />
        <Route path="/customer/:id/services" element={<CustomerServices />} />
        <Route path="/customer/:id/order" element={<CustomerServiceOrder />} />
        <Route path="/customer/:id/date" element={<CustomerDate />} />
        <Route path="/customer/:id/confirm" element={<CustomerConfirm />} />
  <Route path="/customer/:id/tokens" element={<CustomerTokens />} />
        <Route
          path="/user/:name"
          element={
            <RequireAuth>
              <User />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
