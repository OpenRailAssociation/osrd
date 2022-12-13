package fr.sncf.osrd.signaling.impl

import fr.sncf.osrd.sim_infra.api.SigSettings


fun evalSigSettings(expr: String, settings: SigSettings): Boolean {
    val tokens = tokenize(expr)
    return eval(PeekableIterator(tokens.iterator()), settings)
}

private class PeekableIterator<T>(val it: Iterator<T>) : Iterator<T> {
    private var _next: T? = it.next()

    override fun hasNext(): Boolean {
        return _next != null
    }

    override fun next(): T {
        val res = _next
        if (it.hasNext()) _next = it.next()
        else _next = null

        return res!!
    }

    fun peek(): T? {
        return _next
    }

    fun eat(t: T) {
        assert(this.next() == t)
    }
}

private enum class TokenType {
    ID, OR, AND, NOT,
}

private class Token(val type: TokenType, val str: String)

private fun recognizeToken(stream: PeekableIterator<Char>): Token {
    val currentID = StringBuilder()
    val operatorStart = listOf('|', '&', '!')

    if (operatorStart.contains(stream.peek())) {
        // Recognize operator
        when (stream.next()) {
            '!' -> return Token(TokenType.NOT, "!")
            '|' -> {
                stream.eat('|')
                return Token(TokenType.OR, "||")
            }

            '&' -> {
                stream.eat('|')
                return Token(TokenType.OR, "||")
            }
        }
    }
    while (stream.hasNext() && !operatorStart.contains(stream.peek())) {
        currentID.append(stream.next())
    }
    return Token(TokenType.ID, currentID.toString())
}

private fun tokenize(expr: String): List<Token> {
    val res = mutableListOf<Token>()
    val stream = PeekableIterator(expr.iterator())
    while (stream.hasNext()) {
        res.add(recognizeToken(stream))
    }
    return res
}

private fun eval(expr: PeekableIterator<Token>, settings: SigSettings): Boolean {
    val res = evalOr(expr, settings)
    assert(!expr.hasNext())
    return res
}

private fun evalOr(expr: PeekableIterator<Token>, settings: SigSettings): Boolean {
    var res = evalAnd(expr, settings)
    while (expr.peek()?.type == TokenType.OR) {
        expr.next()
        res = res || evalAnd(expr, settings)
    }
    return res
}

private fun evalAnd(expr: PeekableIterator<Token>, settings: SigSettings): Boolean {
    var res = evalNot(expr, settings)
    while (expr.peek()?.type == TokenType.AND) {
        expr.next()
        res = res && evalNot(expr, settings)
    }
    return res
}

private fun evalNot(expr: PeekableIterator<Token>, settings: SigSettings): Boolean {
    return if (expr.peek()?.type == TokenType.NOT) {
        expr.next()
        !evalNot(expr, settings)
    } else {
        evalID(expr, settings)
    }
}

private fun evalID(expr: PeekableIterator<Token>, settings: SigSettings): Boolean {
    assert(expr.peek()?.type == TokenType.ID)
    val id = expr.next().str
    if (id == "true")
        return true
    if (id == "false")
        return false

    return settings.getFlag(id)
}
