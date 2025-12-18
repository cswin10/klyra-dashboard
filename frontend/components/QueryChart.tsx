"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { DailyQueryCount } from "@/lib/api";

interface QueryChartProps {
  data: DailyQueryCount[];
}

export function QueryChart({ data }: QueryChartProps) {
  return (
    <div className="glass-card rounded-card p-card-padding relative overflow-hidden">
      {/* Background gradient accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-silver/20 to-transparent" />

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">
          Queries Over Time
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-silver shadow-[0_0_8px_rgba(192,192,192,0.6)]" />
          <span className="text-sm text-text-secondary">Queries</span>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="queryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0c0c0" stopOpacity={0.2} />
                <stop offset="50%" stopColor="#2d4a7c" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#1a365d" stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.05)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#606070"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#606070"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 15, 20, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#ffffff",
                backdropFilter: "blur(10px)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              }}
              itemStyle={{ color: "#c0c0c0" }}
              labelStyle={{ color: "#a0a0b0" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#c0c0c0"
              strokeWidth={2}
              fill="url(#queryGradient)"
              filter="url(#glow)"
              dot={{ fill: "#c0c0c0", strokeWidth: 0, r: 4 }}
              activeDot={{ fill: "#ffffff", strokeWidth: 0, r: 6, filter: "url(#glow)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
