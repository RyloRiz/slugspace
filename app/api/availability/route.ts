import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lid = searchParams.get("lid") || "16577";
  const gid = searchParams.get("gid") || "34977";
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return Response.json({ error: "start and end params required" }, { status: 400 });
  }

  const body = new URLSearchParams({
    lid,
    gid,
    eid: "-1",
    seat: "0",
    seatId: "0",
    zone: "0",
    start,
    end,
    pageIndex: "0",
    pageSize: "50",
  });

  const res = await fetch(
    "https://calendar.library.ucsc.edu/spaces/availability/grid",
    {
      method: "POST",
      headers: {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://calendar.library.ucsc.edu",
        "referer": "https://calendar.library.ucsc.edu/spaces",
        "x-requested-with": "XMLHttpRequest",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    return Response.json(
      { error: "Failed to fetch availability" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
