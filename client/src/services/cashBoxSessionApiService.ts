
import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
const API_BASE = `${baseUrl}/api/cashbox-sessions`;

export const getActiveCashBoxSession = async () => {
  // Fetch all sessions and return the open one (if any)
  const { data } = await axios.get(API_BASE);
  return data.find((session: any) => session.status === 'open') || null;
};

export const createCashBoxSession = async (payload: { openingAmount: number, openedBy: string }) => {
  const { data } = await axios.post(API_BASE, payload);
  return data;
};

export const closeCashBoxSession = async (id: string, payload: { closingAmount: number, closedBy: string }) => {
  const { data } = await axios.patch(`${API_BASE}/${id}`, payload);
  return data;
};
