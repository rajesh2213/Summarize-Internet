const { encoding_for_model } = require("js-tiktoken");
const logger = require("../../config/logHandler");

function tokenize(text, model="gpr-4") {
    if(!text) return { model, tokenCount: 0, tokens: [] }

    try {
        const encoding = encoding_for_model(model)
        const tokens = encoding.encode(text);
        return {
            model,
            tokenCount: tokens.length,
            tokens
        }
    }catch (error) {
        logger.error("Tokenization failed", {errMessage: error.message, errStack: error.stack})
        throw new Error(`Tokenization failed: ${err.message}`);

    }
}

module.exports = {tokenize}