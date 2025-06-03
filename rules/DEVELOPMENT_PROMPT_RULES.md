# Development Prompt Rules

## Quick Reference for AI Assistant

### Documentation Protocol
- Record all ideas in working file with ✅/❌ markers
- Never delete ideas (avoid revisiting failed approaches)
- Document progress after each successful stage

### Testing Protocol
- Verify new changes don't break existing tests
- Replace stubs with real implementations
- Create granular tests grouped by functionality
- Map test dependencies to prevent regressions
- **Ensure test context cleanup between tests**
- **Create tests for every new feature**
- **Verify functional coverage at end of each step/phase**

### Integration Protocol
- **Design phases/steps in isolation when possible**
- **Plan explicit integration steps for combining components**
- **Include integration phases in project timeline**
- **Test integration points separately from individual components**

### Debugging Protocol
1. Manual trace with expected results first
2. Log trace in separate markdown file
3. Mark error step location
4. Then debug and fix
5. Build dependency maps from failing tests

### Implementation Checklist
- [ ] Document current thoughts/verification needs
- [ ] Mark ideas as ✅ successful or ❌ failed
- [ ] Verify no existing test breakage
- [ ] Check tests use real implementations (not stubs)
- [ ] Replace any temporary stubs
- [ ] **Ensure test context isolation and cleanup**
- [ ] **Create comprehensive tests for new features**
- [ ] **Verify functional coverage matches phase requirements**
- [ ] Document stage completion
- [ ] **Plan and execute integration steps for isolated components**
- [ ] For complex bugs: trace → log → debug → fix
- [ ] Create granular tests by functionality
- [ ] Update test dependency maps

### Quality Gates
- Run full test suite after changes
- Maintain test independence where possible
- **Implement proper test cleanup and context isolation**
- Document test dependencies when they exist
- Preserve working functionality during development
- **Validate test coverage for all planned functionality**
- **Test integration points between components**