// src/utils/response.js
// Standardized API response helpers

export const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

export const created = (res, data = null, message = 'Created successfully') => {
  return success(res, data, message, 201);
};

export const paginated = (res, paginatedData, message = 'Success') => {
  const { rows, total, page, limit, totalPages, hasNext, hasPrev } = paginatedData;
  return res.status(200).json({
    success: true,
    message,
    data: rows,
    pagination: { total, page, limit, totalPages, hasNext, hasPrev },
    timestamp: new Date().toISOString(),
  });
};

export const error = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(details && process.env.NODE_ENV !== 'production' && { details }),
    timestamp: new Date().toISOString(),
  });
};

export const notFound = (res, resource = 'Resource') => {
  return error(res, `${resource} not found`, 404);
};

export const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, 401);
};

export const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, 403);
};

export const badRequest = (res, message = 'Bad request', details = null) => {
  return error(res, message, 400, details);
};

export const validationError = (res, details) => {
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: details,
    timestamp: new Date().toISOString(),
  });
};
