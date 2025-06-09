"use client"

import React from 'react'
import { motion } from 'framer-motion'

interface ModelLogoProps {
  provider: "openai" | "claude" | "gemini" | "deepseek" | "grok" | "openrouter"
  isLoading?: boolean
  size?: "sm" | "md" | "lg"
}

const ModelLogo: React.FC<ModelLogoProps> = ({ provider, isLoading = false, size = "md" }) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  }

  const logoVariants = {
    idle: { scale: 1, opacity: 1 },
    loading: { 
      scale: [1, 1.1, 1],
      opacity: [1, 0.7, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  const getProviderLogo = () => {
    switch (provider) {
      case "openai":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-black dark:bg-white flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 fill-white dark:fill-black">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zm-2.4569-11.0932a4.4748 4.4748 0 0 1 2.35-1.9728V9.7731a.7806.7806 0 0 0 .3927.6813l5.8428 3.3685-2.02 1.1686a.0757.0757 0 0 1-.071 0L2.86 12.004a4.4992 4.4992 0 0 1-.6572-5.1537zm16.5666 3.9956a4.4708 4.4708 0 0 1-.5346 3.0137l-.142-.0852-4.7806-2.7582a.7712.7712 0 0 0-.7806 0L9.74 14.8447V12.5123a.0804.0804 0 0 1 .0332-.0615l4.9618-2.8626a4.4992 4.4992 0 0 1 6.1408 1.6464zM21.2457 14.225l-2.3258-1.3430a.0757.0757 0 0 1-.038-.052V7.2729a4.504 4.504 0 0 1 7.3536 1.1686zm-1.6464-3.9956A4.4708 4.4708 0 0 1 22.0716 6.8977L9.74 4.2395a4.4992 4.4992 0 0 1 6.1408-1.6464l4.9618 2.8626a.0804.0804 0 0 1 .0332.0615v5.5826z"/>
            </svg>
          </div>
        )
        
      case "claude":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm`}>
            <span>C</span>
          </div>
        )
        
      case "gemini":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 fill-white">
              <path d="M12 2l3.09 6.26L22 9l-5.91 3.74L17.18 22 12 19.27 6.82 22l1.09-9.26L2 9l6.91-.74L12 2z"/>
            </svg>
          </div>
        )
        
      case "deepseek":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 fill-white">
              <path d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8-8-3.58-8-8zm11-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-6 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3 3.5c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm0-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4.47 3.8c.28-.4.48-.86.59-1.35.1-.46-.08-.92-.48-1.2-.4-.28-.96-.18-1.24.22-.28.4-.48.86-.59 1.35-.1.46.08.92.48 1.2.4.28.96.18 1.24-.22zM7.53 14.8c-.28-.4-.48-.86-.59-1.35-.1-.46.08-.92.48-1.2.4-.28.96-.18 1.24.22.28.4.48.86.59 1.35.1.46-.08.92-.48 1.2-.4.28-.96.18-1.24-.22z"/>
            </svg>
          </div>
        )
        
      case "grok":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm`}>
            <span>G</span>
          </div>
        )
        
      case "openrouter":
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" className="w-3/4 h-3/4 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        )
        
      default:
        return (
          <div className={`${sizeClasses[size]} rounded-lg bg-gray-500 flex items-center justify-center text-white font-bold text-sm`}>
            <span>AI</span>
          </div>
        )
    }
  }

  return (
    <motion.div
      variants={logoVariants}
      animate={isLoading ? "loading" : "idle"}
      className="flex items-center justify-center"
    >
      {getProviderLogo()}
    </motion.div>
  )
}

export default ModelLogo 