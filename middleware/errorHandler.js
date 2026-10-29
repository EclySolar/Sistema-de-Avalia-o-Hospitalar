function errorHandler(err, _req, res, _next) {
  console.error(err.message);
  res
    .status(err.status || 500)
    .json({
      success: false,
      message: err.status
        ? err.message
        : "Não foi possível realizar a operação.",
      errors: err.errors || [],
    });
}
module.exports = { errorHandler };
