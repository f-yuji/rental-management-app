"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { demoData } from "@/lib/demo-data";
import type { AppData } from "@/types";
type Context={data:AppData; setData:React.Dispatch<React.SetStateAction<AppData>>; reset:()=>void; ready:boolean};
const AppContext=createContext<Context|null>(null);
export function AppProvider({children}:{children:React.ReactNode}){
  const [data,setData]=useState(demoData); const [ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=localStorage.getItem("rental-manager-data");if(saved)setData(JSON.parse(saved) as AppData)}finally{setReady(true)}},[]);
  useEffect(()=>{if(ready)localStorage.setItem("rental-manager-data",JSON.stringify(data))},[data,ready]);
  return <AppContext.Provider value={{data,setData,ready,reset:()=>setData(demoData)}}>{children}</AppContext.Provider>;
}
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error("AppProvider is missing");return value}
