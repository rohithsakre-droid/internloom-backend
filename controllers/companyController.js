const Company = require('../models/Company');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');

const getMyCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.user.id).select('-passwordHash -refreshTokenHash');
  if (!company) throw new AppError(404, 'NOT_FOUND', 'Company not found');
  return success(res, 200, company);
});

const updateMyCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.user.id);
  if (!company) throw new AppError(404, 'NOT_FOUND', 'Company not found');

  const { companyName, description, website } = req.body;
  if (companyName !== undefined) company.companyName = companyName;
  if (description !== undefined) company.description = description;
  if (website !== undefined) company.website = website;
  await company.save();

  return success(res, 200, company);
});

module.exports = { getMyCompany, updateMyCompany };
