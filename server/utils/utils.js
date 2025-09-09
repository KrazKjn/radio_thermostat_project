function convertToTwoDecimalFloat(text) {
    const num = parseFloat(text);
    return isNaN(num) ? null : parseFloat(num.toFixed(2));
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    return {
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes()
    };
}

module.exports = {
    convertToTwoDecimalFloat,
    formatTimestamp,
};
