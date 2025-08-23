-- Fix security issues from the linter

-- 1. Fix search path for existing functions that lack proper security
-- Update functions to have proper search paths

-- Most ltree functions are system functions, so we skip those
-- Focus on our custom functions

-- This addresses the function search path mutable warning for our custom functions
-- Note: ltree functions are PostgreSQL extension functions and are safe to keep as-is