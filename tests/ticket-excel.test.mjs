import {test} from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createTicketWorkbook} from '../lib/ticket-excel.ts';
test('Excel round trip preserves accented text, SEI zeros and literal formula-like comments',async()=>{
 const sheets=[{name:'Tickets',headers:['Ticket','SEI','Projeto'],rows:[['TK-000013','000123','Gestão e aprovação']]},{name:'Histórico e comentários',headers:['Comentário'],rows:[['=HYPERLINK("https://example.com")']]},{name:'Etapas',headers:['Etapa'],rows:[]}];
 const data=await createTicketWorkbook(sheets);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(data);
 assert.equal(workbook.worksheets.length,3);
 assert.equal(workbook.getWorksheet('Tickets').getCell('B2').value,'000123');
 assert.equal(workbook.getWorksheet('Tickets').getCell('C2').value,'Gestão e aprovação');
 const cell=workbook.getWorksheet('Histórico e comentários').getCell('A2');
 assert.equal(cell.type,ExcelJS.ValueType.String);
 assert.equal(cell.value,'=HYPERLINK("https://example.com")');
 assert.equal(workbook.getWorksheet('Etapas').rowCount,1);
 assert.equal(workbook.getWorksheet('Tickets').views[0].ySplit,1);
});
