import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_BASE_URL || ''

export async function getAllCategories() {
  const res = await axios.get(`${baseUrl}/api/categories`);
  return res.data;
}
