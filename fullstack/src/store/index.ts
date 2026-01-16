import { create } from 'zustand'
import { authSlice, type AuthSlice } from './slices/authSlice'
import { uiSlice, type UiSlice } from './slices/uiSlice'

type StoreState = AuthSlice & UiSlice

export const useStore = create<StoreState>((set, get) => ({
  ...authSlice(set, get),
  ...uiSlice(set, get),
}))
