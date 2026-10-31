import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { createTestDatabase } from "../../db/test-database";
import type { Pool } from "pg";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { buildReport } from "./datasets";
test("report reads are allowlisted, current, same-origin and never change source records",async()=>{
  const directory=await mkdtemp(path.resolve(".reports-test-"));
  const previous=process.env.CONVENER_DB_PATH;
  process.env.CONVENER_DB_PATH=path.join(directory,"test.db");
  const sqlite=await createTestDatabase();
  let applicationDb: Pool | undefined;
  const nextHeaders=createRequire(import.meta.url)("next/headers") as typeof import("next/headers");
  let request=new Headers({host:"localhost:3000",origin:"http://localhost:3000"});
  const headersMock=mock.method(nextHeaders,"headers",async()=>request);
  const cookieMock=mock.method(nextHeaders,"cookies",async()=>RequestCookiesAdapter.seal(new RequestCookies(new Headers({cookie:"convener-data-scope=ndc"}))));
  try{
    (await sqlite.exec(`
      INSERT INTO opponent_clubs(id,name,par,slope_rating,course_rating) VALUES(1,'Visitors',NULL,0,71.5);
      INSERT INTO players(id,name,email,phone,created_at) VALUES
        (1,'One','private@example.test','SECRET_PHONE','2026-01-01'),
        (2,'Two',NULL,NULL,'2026-01-01');
      INSERT INTO fixtures(id,date,opponent_club_id,home_away,notes,venue_name,team_name,opponent_team_name,created_at)
        VALUES(1,'2026-01-01',1,'home','SECRET_FIXTURE_NOTE','Explicit venue','Our team','Away team','2026-01-01');
      INSERT INTO matches(fixture_id,player1_id,player2_id,opponent1_name,opponent2_name,result,player1_handicap,player2_handicap,notes)
        VALUES(1,1,2,'Away one','Away two','win',0,NULL,'SECRET_MATCH_NOTE');
    `));
    const {getReportSource}=await import("./request");
    applicationDb=(await import("@/db")).db.$client;
    const before=(await sqlite.prepare("SELECT * FROM matches").all());
    const data=await getReportSource();
    assert.equal(data.scope,"ndc");
    assert.equal(data.source.fixtures[0].venueName,"Explicit venue");
    assert.equal(data.source.fixtures[0].teamName,"Our team");
    assert.equal(data.source.matches[0].player1Handicap,0);
    assert.equal(data.source.matches[0].player2Handicap,null);
    assert.equal(data.source.clubs[0].slopeRating,0);
    assert.doesNotMatch(JSON.stringify(data),/SECRET_|private@example|email|phone|sourceHash|createdAt/);
    buildReport(data.source,"ndc",{sections:["season","scorecard","clubs"]});
    assert.deepEqual((await sqlite.prepare("SELECT * FROM matches").all()),before);
    (await sqlite.prepare("UPDATE matches SET result='loss' WHERE id=1").run());
    assert.equal((await getReportSource()).source.matches[0].result,"loss");
    assert.equal(data.source.matches[0].result,"win","Earlier previews retain their snapshot");
    for(const headers of [
      new Headers({host:"public.example"}),
      new Headers({host:"localhost:3000",origin:"https://other.example"}),
      new Headers({host:"localhost:3000","sec-fetch-site":"cross-site"}),
    ]){
      request=new Headers(headers);
      await assert.rejects(getReportSource,/not configured|Cross-origin/);
    }
  }finally{
    headersMock.mock.restore();cookieMock.mock.restore();
    await applicationDb?.end();await sqlite.close();
    if(previous===undefined)delete process.env.CONVENER_DB_PATH;else process.env.CONVENER_DB_PATH=previous;
    await rm(directory,{recursive:true,force:true});
  }
});
