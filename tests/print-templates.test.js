'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('database schema defines a separate persistent print template sheet', () => {
  const schema = read('DatabaseSetup.js');
  assert.match(schema, /name: '36_PrintTemplates'/);
  assert.match(schema, /'ID','TenantID','Name','Description','LayoutJSON','Version','Status','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'/);
});

test('print template repository creates the sheet without deleting or resetting existing data', () => {
  const repository = read('PrintTemplateRepository.js');
  assert.match(repository, /getSpreadsheet\(\)/);
  assert.match(repository, /insertSheet\(this\.SHEET_NAME\)/);
  assert.match(repository, /ensureColumn\(this\.SHEET_NAME, header\)/);
  assert.doesNotMatch(repository, /deleteSheet|clear\(/);
});

test('print template API is tenant-scoped and requires project permissions', () => {
  const router = read('Router.js');
  assert.match(router, /printTemplateMatch[\s\S]{0,180}PROJECT_VIEW[\s\S]{0,160}PrintTemplateService/);
  assert.match(router, /path === '\/print-templates'[\s\S]{0,120}PROJECT_EDIT[\s\S]{0,100}PrintTemplateService\.create/);
  assert.match(router, /printTemplateUpdateMatch[\s\S]{0,120}PROJECT_EDIT/);
  assert.match(router, /printTemplateDeleteMatch[\s\S]{0,120}PROJECT_EDIT/);
  const service = read('PrintTemplateService.js');
  assert.match(service, /String\(item\.TenantID\) === String\(user\.TenantID\)/);
  assert.match(service, /String\(item\.TenantID\) !== String\(tenantId\)/);
});

test('print template service validates layout size and structure and soft-deletes records', () => {
  const service = read('PrintTemplateService.js');
  assert.match(service, /MAX_LAYOUT_LENGTH: 40000/);
  assert.match(service, /Array\.isArray\(layout\.elements\)/);
  assert.match(service, /elements\.length > 200/);
  assert.match(service, /LayoutJSON: layout\.json/);
  assert.match(service, /Status:'INACTIVE'/);
  assert.match(service, /AuditService\.log/);
});


test('print template service persists, updates and soft-deletes tenant-owned layouts', () => {
  const vm = require('node:vm');
  const serviceSource = read('PrintTemplateService.js');
  const records = [];
  let currentUser = {ID:'USR_A',TenantID:'TEN_A'};
  const audit = [];
  const repository = {
    getAll: () => records,
    findById: id => records.find(item => item.ID === id) || null,
    insert: item => { records.push(item); return item; },
    update: (id, patch) => {
      const item = records.find(entry => entry.ID === id);
      if (!item) throw new Error('missing');
      Object.assign(item, patch);
      return item;
    }
  };
  const sandbox = {
    PrintTemplateRepository: repository,
    AccessControlService: {getCurrentUser: () => currentUser},
    Constants: {ERROR:{UNAUTHORIZED:'UNAUTHORIZED',VALIDATION_ERROR:'VALIDATION_ERROR',NOT_FOUND:'NOT_FOUND',DUPLICATE:'DUPLICATE'},ACTION:{CREATE:'CREATE',UPDATE:'UPDATE',DELETE:'DELETE'}},
    ErrorHandler: {create:(code,message)=>Object.assign(new Error(message),{code})},
    Response: {success:(data,meta)=>({success:true,data,meta:meta||{}})},
    Utilities: {getUuid:()=> '12345678-1234-1234-1234-123456789012'},
    AuditService: {log:item=>audit.push(item)},
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    Error
  };
  vm.runInNewContext(serviceSource + '; this.PrintTemplateService = PrintTemplateService;', sandbox);
  const service = sandbox.PrintTemplateService;
  const created = service.create({Name:'گزارش تولید',Layout:{version:2,orientation:'portrait',elements:[{type:'text',text:'نمونه'}]}},{});
  assert.equal(created.success,true);
  assert.equal(records.length,1);
  assert.equal(records[0].TenantID,'TEN_A');
  assert.equal(created.data.Layout.elements[0].text,'نمونه');
  assert.equal(service.list({}).data.length,1);

  currentUser = {ID:'USR_B',TenantID:'TEN_B'};
  assert.equal(service.list({}).data.length,0);
  assert.throws(()=>service.get(records[0].ID,{}),/قالب چاپ موردنظر پیدا نشد/);

  currentUser = {ID:'USR_A',TenantID:'TEN_A'};
  const id = records[0].ID;
  const updated = service.update(id,{Name:'گزارش نهایی'},{});
  assert.equal(updated.data.Name,'گزارش نهایی');
  const removed = service.remove(id,{});
  assert.equal(removed.data.Status,'INACTIVE');
  assert.equal(service.list({}).data.length,0);
  assert.ok(audit.length >= 3);
});

test('print template service rejects malformed layouts, oversized payloads and duplicate names', () => {
  const vm = require('node:vm');
  const records = [];
  const sandbox = {
    PrintTemplateRepository: {
      getAll:()=>records,
      findById:id=>records.find(item=>item.ID===id)||null,
      insert:item=>records.push(item),
      update:(id,patch)=>Object.assign(records.find(item=>item.ID===id),patch)
    },
    AccessControlService:{getCurrentUser:()=>({ID:'USR_A',TenantID:'TEN_A'})},
    Constants:{ERROR:{UNAUTHORIZED:'UNAUTHORIZED',VALIDATION_ERROR:'VALIDATION_ERROR',NOT_FOUND:'NOT_FOUND',DUPLICATE:'DUPLICATE'},ACTION:{CREATE:'CREATE',UPDATE:'UPDATE',DELETE:'DELETE'}},
    ErrorHandler:{create:(code,message)=>Object.assign(new Error(message),{code})},
    Response:{success:(data,meta)=>({success:true,data,meta:meta||{}})},
    Utilities:{getUuid:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},
    Date,JSON,Object,Array,String,Number,Error
  };
  vm.runInNewContext(read('PrintTemplateService.js') + '; this.PrintTemplateService = PrintTemplateService;',sandbox);
  const service=sandbox.PrintTemplateService;
  assert.throws(()=>service.create({Name:'جهت نامعتبر',Layout:{version:2,orientation:'diagonal',elements:[]} },{}),/نسخه یا جهت صفحه قالب معتبر نیست/);
  assert.throws(()=>service.create({Name:'ساختار نامعتبر',Layout:{version:2,orientation:'portrait',elements:'invalid'}},{}),/قالب باید شامل فهرست معتبر/);
  assert.throws(()=>service.create({Name:'بزرگ',Layout:{version:2,orientation:'portrait',elements:[{text:'x'.repeat(41000)}]}},{}),/حجم قالب بیش از حد مجاز/);
  service.create({Name:'قالب تکراری',Layout:{version:2,orientation:'portrait',elements:[]}},{});
  assert.throws(()=>service.create({Name:'قالب تکراری',Layout:{version:2,orientation:'portrait',elements:[]} },{}),/قالب فعالی با این نام/);
});
