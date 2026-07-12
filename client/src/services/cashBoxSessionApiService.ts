
import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
const API_BASE = `${baseUrl}/api/cashbox-sessions`;

export interface CashBoxSessionBalance {
  sessionId: string;
  openingAmount: number;
  totalPayments: number;
  totalBankPayments: number;
  totalExpenses: number;
  totalDeposits: number;
  totalWithdrawals: number;
  currentAmount: number;
}

export const getActiveCashBoxSession = async () => {
  // Fetch all sessions and return the open one (if any)
  const { data } = await axios.get(API_BASE);
  return data.find((session: any) => session.status === 'open') || null;
};

export const createCashBoxSession = async (payload: { openingAmount: number, openedBy: string, openedAt?: string }) => {
  const { data } = await axios.post(API_BASE, payload);
  return data;
};

export const getLastClosedCashBoxSession = async () => {
  const { data } = await axios.get(API_BASE);
  const closed = data.filter((s: any) => s.status === 'closed');
  if (!closed || closed.length === 0) return null;
  closed.sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  return closed[0];
};

export const closeCashBoxSession = async (
  id: string,
  payload: { closingAmount: number; closedBy: string; status?: string }
) => {
  const { data } = await axios.patch(`${API_BASE}/${id}`, payload);
  return data;
};

export const getCashBoxSessionBalance = async (id: string): Promise<CashBoxSessionBalance> => {
  const { data } = await axios.get(`${API_BASE}/${id}/balance`);
  return data;
};
