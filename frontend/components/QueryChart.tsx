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
    <div className="bg-card-bg rounded-card border border-card-border p-card-padding shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">
          Queries Over Time
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent"></div>
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
                <stop offset="0%" stopColor="#3dd9c6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3dd9c6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2d3d"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#5a6a78"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#5a6a78"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#151d28",
                border: "1px solid #1e2d3d",
                borderRadius: "8px",
                color: "#ffffff",
              }}
              itemStyle={{ color: "#3dd9c6" }}
              labelStyle={{ color: "#8899a8" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3dd9c6"
              strokeWidth={2}
              fill="url(#queryGradient)"
              dot={{ fill: "#3dd9c6", strokeWidth: 0, r: 4 }}
              activeDot={{ fill: "#3dd9c6", strokeWidth: 0, r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
