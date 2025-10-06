import rootReducer from "@/redux/rootReducer";
import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

const store = configureStore({
  reducer: rootReducer,
})

export default store;

export type IRootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

export const useAppDispath = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<IRootState> = useSelector;