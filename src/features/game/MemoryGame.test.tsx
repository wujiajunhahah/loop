import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryGame } from './MemoryGame'

describe('MemoryGame', () => {
  afterEach(() => cleanup())

  it('moves through all five chapters without turning grief into a score', () => {
    render(<MemoryGame />)

    expect(screen.getByRole('heading', { name: '我在，你看见。' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把今天放进来' }))
    expect(screen.getByRole('heading', { name: '我在，你说。' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('写下一句话，或者只写几个词……'), { target: { value: '今天也下雨了。' } })
    fireEvent.click(screen.getByRole('button', { name: '保存这一页' }))
    expect(screen.getByRole('heading', { name: '我在，你寻找。' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /一段声音雨落/ }))
    expect(screen.getByText(/不是天气记录/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '把它带回生活' }))
    expect(screen.getByRole('heading', { name: '我在，你去做。' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '我做了这件事' }))
    fireEvent.change(screen.getByLabelText('如果愿意，留下这一刻的新章节'), { target: { value: '我在窗边听了一会儿雨。' } })
    fireEvent.click(screen.getByRole('button', { name: '继续往前' }))
    expect(screen.getByRole('heading', { name: '你在。' })).toBeInTheDocument()
    expect(screen.getByText('我在窗边听了一会儿雨。')).toBeInTheDocument()
    expect(screen.getByText('由你写下')).toBeInTheDocument()
    expect(screen.queryByText(/分数|亲密度|连续签到/)).not.toBeInTheDocument()
  })

  it('allows leaving before completing an optional real-life action', () => {
    render(<MemoryGame />)
    fireEvent.click(screen.getByRole('button', { name: '把今天放进来' }))
    fireEvent.click(screen.getByRole('button', { name: '先不写，也可以' }))
    fireEvent.click(screen.getByRole('button', { name: /一件物品一把伞/ }))
    fireEvent.click(screen.getByRole('button', { name: '把它带回生活' }))

    expect(screen.getByRole('button', { name: '继续往前' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /离开旅程/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '我做了这件事' }))
    fireEvent.click(screen.getByRole('button', { name: '继续往前' }))
    expect(screen.getByText('没有生成替代内容')).toBeInTheDocument()
    expect(screen.queryByText('由你写下')).not.toBeInTheDocument()
  })
})
