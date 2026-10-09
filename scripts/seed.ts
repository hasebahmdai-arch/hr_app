import { format, subDays } from "date-fns";
import connectDB from "../src/lib/db";
import {
  Announcement,
  Asset,
  CompanyDocument,
  Department,
  Employee,
  LeaveRequest,
  Notification,
  PunchRequest,
  Shift,
  Timesheet,
} from "../src/lib/models";
import { generateRequestCode } from "../src/lib/request-code";

async function seedDemo() {
  await connectDB();

  const employeeCount = await Employee.countDocuments();
  if (employeeCount === 0) {
    console.error("No users found. Complete /setup first, then add employees via HR before running seed:demo.");
    process.exit(1);
  }

  const hrUser = await Employee.findOne({ role: "hr", accountActive: true });
  if (!hrUser) {
    console.error("No active HR user found. Create an HR account before running seed:demo.");
    process.exit(1);
  }

  let depts = await Department.find();
  if (!depts.length) {
    depts = await Department.insertMany([
      { name: "Engineering", code: "ENG", description: "Product engineering" },
      { name: "Human Resources", code: "HR", description: "People operations" },
      { name: "Operations", code: "OPS", description: "Business operations" },
    ]);
  }

  let shifts = await Shift.find();
  if (!shifts.length) {
    shifts = await Shift.insertMany([
      { name: "Morning Shift", code: "MORN", startTime: "09:00", endTime: "18:00", breakMinutes: 60 },
      { name: "Evening Shift", code: "EVE", startTime: "14:00", endTime: "23:00", breakMinutes: 60 },
    ]);
  }

  const allEmployees = await Employee.find({ role: "employee", accountActive: true });
  if (!allEmployees.length) {
    console.error("No active employees found. Add employees via HR before running seed:demo.");
    process.exit(1);
  }

  await Timesheet.deleteMany({});
  await PunchRequest.deleteMany({});
  await LeaveRequest.deleteMany({});
  await Asset.deleteMany({});
  await CompanyDocument.deleteMany({});
  await Announcement.deleteMany({});
  await Notification.deleteMany({});

  const statusCodes = ["P", "P", "P", "W", "A", "M", "L", "H", "O", "S"];

  for (const emp of allEmployees) {
    for (let d = 1; d < 30; d++) {
      const date = format(subDays(new Date(), d), "yyyy-MM-dd");
      const code = statusCodes[d % statusCodes.length];
      const checkIn = code === "P" || code === "W" ? subDays(new Date(), d) : null;
      if (checkIn && code === "P") {
        checkIn.setHours(9, 5 + (d % 20), 0, 0);
      }
      await Timesheet.create({
        employeeId: emp._id,
        date,
        shiftId: emp.shiftId,
        checkIn: checkIn,
        checkOut: checkIn ? new Date(checkIn.getTime() + 8 * 60 * 60 * 1000) : undefined,
        checkinStatus: checkIn ? (d % 5 === 0 ? "Late" : "On Time") : undefined,
        checkoutStatus: checkIn ? "On Time" : undefined,
        workedMinutes: checkIn ? 480 : 0,
        expectedMinutes: 480,
        statusCode: code,
        source: "punch",
      });
    }

    await Asset.create({
      employeeId: emp._id,
      assetName: "MacBook Pro",
      serialNumber: `SN-${emp.employeeCode}`,
      assignedDate: emp.hireDate,
      status: "ASSIGNED",
    });
  }

  for (const emp of allEmployees.slice(0, 3)) {
    await LeaveRequest.create({
      requestCode: await generateRequestCode("leave"),
      employeeId: emp._id,
      leaveType: "Annual",
      startDate: subDays(new Date(), 2),
      endDate: subDays(new Date(), -2),
      reason: "Family vacation",
      status: emp === allEmployees[0] ? "PENDING" : "COMPLETED",
    });
  }

  await PunchRequest.create({
    requestCode: await generateRequestCode("punch"),
    employeeId: allEmployees[0]._id,
    punchType: "CHECK_IN",
    requestedTimestamp: new Date(),
    reason: "Forgot to punch",
    status: "PENDING",
  });

  await CompanyDocument.create({
    title: "Employee Handbook",
    category: "policies",
  });

  await Announcement.create({
    title: "Welcome to HR Portal",
    body: "Your new self-service portal is live!",
    type: "newsletter",
    publishedAt: new Date(),
    createdBy: hrUser._id,
  });

  await Notification.create({
    userId: allEmployees[0]._id,
    title: "Welcome",
    body: "Welcome to the HR portal!",
    type: "SYSTEM",
    read: false,
  });

  console.log("Demo data seeded successfully.");
  process.exit(0);
}

seedDemo().catch((e) => {
  console.error(e);
  process.exit(1);
});
